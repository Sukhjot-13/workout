// Shared request/payload validation for the API routes and the client.
//
// Everything the server stores is whitelist-constructed here so a raw client
// value can never reach a Mongo filter or a `$set` document as an operator
// object. Error strings returned to clients are FIXED codes; the underlying
// cause is only ever logged server-side.

export const MAX_BODY_BYTES = 256 * 1024;
export const MAX_ITEMS = 500;
export const MAX_SETS_PER_ITEM = 20;
export const MAX_SET_COUNT = 20;
export const MAX_WEIGHT = 1000;
export const MAX_REPS = 10000;
export const MAX_VALUE_LENGTH = 500;
export const MAX_PROGRAM_VERSION = 1000000;

export const ERROR_CODES = {
  INVALID_JSON: "INVALID_JSON",
  INVALID_DATE: "INVALID_DATE",
  INVALID_DAY: "INVALID_DAY",
  INVALID_ITEMS: "INVALID_ITEMS",
  INVALID_PROGRAM_VERSION: "INVALID_PROGRAM_VERSION",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL: "INTERNAL_ERROR",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_RE = /^day[1-4]$/;
const LEGACY_ITEM_KEY_RE = /^\d+:\d+$/;
const SLUG_ITEM_KEY_RE = /^day[1-4]:[a-z0-9][a-z0-9-]*$/;
const SET_KEY_RE = /^(?:[1-9]|1\d|20)$/;
const NUMERIC_TEXT_RE = /^\d+(?:\.\d{1,2})?$/;

export function isDateKey(v) {
  return typeof v === "string" && DATE_RE.test(v);
}

export function isDayKey(v) {
  return typeof v === "string" && DAY_RE.test(v);
}

// Legacy payloads key items by position ("2:1"); current payloads key them by a
// stable slug ("day1:goblet-squat"). Both are accepted, anything else (notably
// "$ne"-style operator keys) is rejected.
export function isItemKey(v) {
  return (
    typeof v === "string" &&
    (LEGACY_ITEM_KEY_RE.test(v) || SLUG_ITEM_KEY_RE.test(v))
  );
}

function fail(code) {
  return { ok: false, code };
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isBoundedNumber(v, min, max) {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

// Weight/reps arrive from free-text inputs, so a strict numeric string is
// accepted and normalised to a number. Blank input becomes "absent" rather
// than zero so an untouched set never looks like logged data.
export function coerceNumberInput(value, { min = 0, max = MAX_REPS } = {}) {
  if (value === undefined || value === null) return { present: false };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { present: false, invalid: true };
    if (value < min || value > max) return { present: false, invalid: true };
    return { present: true, value };
  }
  if (typeof value !== "string") return { present: false, invalid: true };
  const trimmed = value.trim();
  if (trimmed === "") return { present: false };
  if (!NUMERIC_TEXT_RE.test(trimmed)) return { present: false, invalid: true };
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < min || num > max) {
    return { present: false, invalid: true };
  }
  return { present: true, value: num };
}

function sanitizeSet(raw) {
  if (!isPlainObject(raw)) return null;
  const out = {};

  if (raw.done !== undefined) {
    if (typeof raw.done !== "boolean") return null;
    out.done = raw.done;
  }

  for (const field of ["weight", "reps"]) {
    if (raw[field] === undefined) continue;
    const max = field === "weight" ? MAX_WEIGHT : MAX_REPS;
    const parsed = coerceNumberInput(raw[field], { min: 0, max });
    if (parsed.invalid) return null;
    if (parsed.present) out[field] = parsed.value;
  }

  for (const key of Object.keys(raw)) {
    if (key === "weight" || key === "reps" || key === "done") continue;
    return null;
  }

  return out;
}

function sanitizeItem(raw) {
  if (!isPlainObject(raw)) return null;
  const out = {};

  if (raw.done !== undefined) {
    if (typeof raw.done !== "boolean") return null;
    out.done = raw.done;
  }

  if (raw.customSetCount !== undefined) {
    if (
      typeof raw.customSetCount !== "number" ||
      !Number.isInteger(raw.customSetCount) ||
      raw.customSetCount < 1 ||
      raw.customSetCount > MAX_SET_COUNT
    ) {
      return null;
    }
    out.customSetCount = raw.customSetCount;
  }

  if (raw.sets !== undefined) {
    if (!isPlainObject(raw.sets)) return null;
    const sets = {};
    for (const setKey of Object.keys(raw.sets)) {
      if (!SET_KEY_RE.test(setKey)) return null;
      const set = sanitizeSet(raw.sets[setKey]);
      if (set === null) return null;
      sets[setKey] = set;
    }
    out.sets = sets;
  }

  for (const field of ["value1", "value2"]) {
    if (raw[field] === undefined) continue;
    if (typeof raw[field] !== "string" || raw[field].length > MAX_VALUE_LENGTH) {
      return null;
    }
    out[field] = raw[field];
  }

  for (const key of Object.keys(raw)) {
    if (
      key === "done" ||
      key === "customSetCount" ||
      key === "sets" ||
      key === "value1" ||
      key === "value2"
    ) {
      continue;
    }
    return null;
  }

  return out;
}

export function sanitizeItems(raw) {
  // An absent `items` means "no data for this session"; an explicit null is a
  // type error and is rejected rather than silently treated as empty.
  if (raw === undefined) return { ok: true, items: {} };
  if (!isPlainObject(raw)) return fail(ERROR_CODES.INVALID_ITEMS);

  const rawKeys = Object.keys(raw);
  if (rawKeys.length > MAX_ITEMS) return fail(ERROR_CODES.INVALID_ITEMS);

  const items = {};
  for (const key of rawKeys) {
    if (!isItemKey(key)) return fail(ERROR_CODES.INVALID_ITEMS);
    const item = sanitizeItem(raw[key]);
    if (item === null) return fail(ERROR_CODES.INVALID_ITEMS);
    items[key] = item;
  }

  return { ok: true, items };
}

export function validateSessionQuery(searchParams) {
  const date = searchParams.get("date");
  const day = searchParams.get("day");

  if (!isDateKey(date)) return fail(ERROR_CODES.INVALID_DATE);
  if (!isDayKey(day)) return fail(ERROR_CODES.INVALID_DAY);

  return { ok: true, date, day };
}

export function validateSessionPayload(body) {
  if (!isPlainObject(body)) return fail(ERROR_CODES.INVALID_ITEMS);
  if (!isDateKey(body.date)) return fail(ERROR_CODES.INVALID_DATE);
  if (!isDayKey(body.day)) return fail(ERROR_CODES.INVALID_DAY);

  const items = sanitizeItems(body.items);
  if (!items.ok) return items;

  let programVersion = null;
  if (body.programVersion !== undefined && body.programVersion !== null) {
    if (
      typeof body.programVersion !== "number" ||
      !Number.isInteger(body.programVersion) ||
      body.programVersion < 0 ||
      body.programVersion > MAX_PROGRAM_VERSION
    ) {
      return fail(ERROR_CODES.INVALID_PROGRAM_VERSION);
    }
    programVersion = body.programVersion;
  }

  return { ok: true, date: body.date, day: body.day, items: items.items, programVersion };
}

export function byteLength(text) {
  return new TextEncoder().encode(text).length;
}

// Reads the body as text so an oversized or malformed payload can be rejected
// with a fixed 413/400 instead of a driver/parser SyntaxError bubbling up as a
// 500 that echoes the request back to the caller.
export async function readJsonBody(request) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return fail(ERROR_CODES.PAYLOAD_TOO_LARGE);
  }

  let text;
  try {
    text = await request.text();
  } catch {
    return fail(ERROR_CODES.INVALID_JSON);
  }

  if (byteLength(text) > MAX_BODY_BYTES) {
    return fail(ERROR_CODES.PAYLOAD_TOO_LARGE);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail(ERROR_CODES.INVALID_JSON);
  }

  return { ok: true, body: parsed };
}
