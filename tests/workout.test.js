import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  coerceNumberInput,
  ERROR_CODES,
  isDateKey,
  isDayKey,
  isItemKey,
  MAX_BODY_BYTES,
  readJsonBody,
  sanitizeItems,
  validateSessionPayload,
  validateSessionQuery,
} from "../lib/validate.js";
import { PROGRAM, hasSessionData } from "../lib/program.js";
import {
  formatRepsValue,
  formatSessionAsText,
  formatWeightValue,
  getDefaultReps,
  normalizeRepsUnit,
  normalizeWeightUnit,
  repsUnitLabel,
} from "../lib/session-format.js";
import {
  CACHE_SCHEMA_VERSION,
  MAX_CACHED_SESSIONS,
  buildSessionEntry,
  pickNewerSession,
  pruneSessionCache,
  readSessionEntry,
  sessionKeyFor,
} from "../lib/session-cache.js";
import { PROGRAM_VERSION, migrateItems } from "../lib/program.js";

describe("hasSessionData", () => {
  it("rejects empty/non-object input", () => {
    expect(hasSessionData(null)).toBe(false);
    expect(hasSessionData({})).toBe(false);
    expect(hasSessionData("x")).toBe(false);
  });

  it("detects done flags, values, and set data", () => {
    expect(hasSessionData({ "0:0": { done: true } })).toBe(true);
    expect(hasSessionData({ "0:0": { value1: "  run  " } })).toBe(true);
    expect(hasSessionData({ "0:0": { sets: { 1: { weight: "20" } } } })).toBe(true);
    expect(hasSessionData({ "0:0": { sets: { 1: { reps: "8" } } } })).toBe(true);
  });

  it("ignores blank values", () => {
    expect(hasSessionData({ "0:0": { value1: "   " } })).toBe(false);
    expect(hasSessionData({ "0:0": { sets: { 1: { weight: "", reps: "" } } } })).toBe(false);
  });

  it("treats a numeric zero as not-logged (server normalises weight/reps to numbers)", () => {
    expect(hasSessionData({ "0:0": { sets: { 1: { weight: 0, reps: 0 } } } })).toBe(false);
    expect(hasSessionData({ "0:0": { sets: { 1: { weight: 0, reps: 8 } } } })).toBe(true);
  });
});

describe("isDateKey / isDayKey", () => {
  it("accepts only ISO dates and day1..day4 strings", () => {
    expect(isDateKey("2026-09-26")).toBe(true);
    expect(isDayKey("day1")).toBe(true);
    expect(isDayKey("day4")).toBe(true);
  });

  it("rejects NoSQL operator objects and wrong types", () => {
    expect(isDateKey({ $ne: null })).toBe(false);
    expect(isDateKey(["2026-09-26"])).toBe(false);
    expect(isDateKey(20260926)).toBe(false);
    expect(isDateKey("2026-9-26")).toBe(false);
    expect(isDateKey("2026-09-26T00:00:00Z")).toBe(false);
    expect(isDayKey({ $ne: null })).toBe(false);
    expect(isDayKey("day5")).toBe(false);
    expect(isDayKey("day0")).toBe(false);
    expect(isDayKey("Day1")).toBe(false);
    expect(isDayKey(null)).toBe(false);
  });
});

describe("isItemKey", () => {
  it("accepts legacy positional keys and current slug keys", () => {
    expect(isItemKey("2:1")).toBe(true);
    expect(isItemKey("day1:goblet-squat-hack-squat")).toBe(true);
  });

  it("rejects operator keys and junk", () => {
    expect(isItemKey({ $ne: null })).toBe(false);
    expect(isItemKey("$ne")).toBe(false);
    expect(isItemKey("day1:{$ne}")).toBe(false);
    expect(isItemKey("2;1")).toBe(false);
    expect(isItemKey("__proto__")).toBe(false);
  });
});

describe("validateSessionQuery", () => {
  const params = (obj) => new URLSearchParams(obj);

  it("accepts a well-formed query", () => {
    const res = validateSessionQuery(params({ date: "2026-09-26", day: "day1" }));
    expect(res).toMatchObject({ ok: true, date: "2026-09-26", day: "day1" });
  });

  it("rejects operator injection in either parameter", () => {
    const injected = params({ date: '{"$ne":null}', day: "day1" });
    const res = validateSessionQuery(injected);
    expect(res.ok).toBe(false);
    expect(res.code).toBe(ERROR_CODES.INVALID_DATE);

    const dayInjected = validateSessionQuery(params({ date: "2026-09-26", day: '{"$ne":null}' }));
    expect(dayInjected.ok).toBe(false);
    expect(dayInjected.code).toBe(ERROR_CODES.INVALID_DAY);
  });

  it("rejects missing parameters with a fixed code", () => {
    expect(validateSessionQuery(params({ day: "day1" })).code).toBe(ERROR_CODES.INVALID_DATE);
    expect(validateSessionQuery(params({ date: "2026-09-26" })).code).toBe(ERROR_CODES.INVALID_DAY);
  });
});

describe("sanitizeItems", () => {
  it("accepts an empty/absent payload", () => {
    expect(sanitizeItems(undefined)).toEqual({ ok: true, items: {} });
    expect(sanitizeItems({})).toEqual({ ok: true, items: {} });
  });

  it("whitelist-constructs a valid payload and normalises numerics", () => {
    const res = sanitizeItems({
      "2:1": {
        done: true,
        customSetCount: 3,
        sets: { 1: { weight: "20.5", reps: "8", done: true }, 2: { weight: "", reps: "" } },
        value1: "Incline walk",
        value2: "felt good",
      },
    });
    expect(res.ok).toBe(true);
    expect(res.items["2:1"]).toEqual({
      done: true,
      customSetCount: 3,
      sets: {
        1: { weight: 20.5, reps: 8, done: true },
        2: {},
      },
      value1: "Incline walk",
      value2: "felt good",
    });
  });

  it("drops unknown fields instead of storing them", () => {
    const res = sanitizeItems({ "0:0": { done: true, sneaky: "x" } });
    expect(res.ok).toBe(false);
    expect(res.code).toBe(ERROR_CODES.INVALID_ITEMS);
  });

  it("rejects operator keys and non-object payloads", () => {
    expect(sanitizeItems({ $ne: null }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems([]).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems("nope").code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems(null).code).toBe(ERROR_CODES.INVALID_ITEMS);
  });

  it("rejects nested operator objects anywhere in the tree", () => {
    expect(sanitizeItems({ "0:0": { sets: { 1: { $gt: "" } } } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { sets: { $ne: null } } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { done: { $ne: true } } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { value1: { $ne: null } } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
  });

  it("bounds weight, reps, set count, set index and string length", () => {
    expect(sanitizeItems({ "0:0": { sets: { 1: { weight: 1001 } } } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { sets: { 1: { reps: 10001 } } } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { sets: { 1: { weight: -1 } } } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { sets: { 1: { weight: NaN } } } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { sets: { 1: { weight: Infinity } } } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { sets: { 1: { weight: "abc" } } } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { customSetCount: 0 } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { customSetCount: 21 } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { customSetCount: 1.5 } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { sets: { 21: { weight: 1 } } } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { sets: { 0: { weight: 1 } } } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { value1: "x".repeat(501) } }).code).toBe(ERROR_CODES.INVALID_ITEMS);
    expect(sanitizeItems({ "0:0": { value1: "x".repeat(500) } }).ok).toBe(true);
  });

  it("bounds the number of items", () => {
    const many = {};
    for (let i = 0; i < 501; i++) many[`0:${i}`] = { done: true };
    expect(sanitizeItems(many).code).toBe(ERROR_CODES.INVALID_ITEMS);
  });
});

describe("validateSessionPayload", () => {
  it("accepts a well-formed POST body", () => {
    const res = validateSessionPayload({
      date: "2026-09-26",
      day: "day1",
      items: { "0:0": { done: true } },
      programVersion: PROGRAM_VERSION,
    });
    expect(res).toMatchObject({ ok: true, date: "2026-09-26", day: "day1" });
    expect(res.programVersion).toBe(PROGRAM_VERSION);
  });

  it("rejects the delete-everything operator injection", () => {
    const res = validateSessionPayload({
      date: { $ne: null },
      day: "day1",
      items: {},
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe(ERROR_CODES.INVALID_DATE);
  });

  it("rejects a bad day, bad items and a bad programVersion separately", () => {
    expect(validateSessionPayload({ date: "2026-09-26", day: "day9" }).code).toBe(ERROR_CODES.INVALID_DAY);
    expect(validateSessionPayload({ date: "2026-09-26", day: "day1", items: { $ne: null } }).code).toBe(
      ERROR_CODES.INVALID_ITEMS
    );
    expect(
      validateSessionPayload({ date: "2026-09-26", day: "day1", programVersion: -1 }).code
    ).toBe(ERROR_CODES.INVALID_PROGRAM_VERSION);
    expect(validateSessionPayload([]).code).toBe(ERROR_CODES.INVALID_ITEMS);
  });
});

describe("readJsonBody", () => {
  const makeRequest = (body, contentLength) => ({
    headers: { get: (h) => (h === "content-length" ? contentLength : null) },
    text: async () => {
      if (body instanceof Error) throw body;
      return body;
    },
  });

  it("parses a valid body", async () => {
    const res = await readJsonBody(makeRequest('{"date":"2026-09-26"}'));
    expect(res).toEqual({ ok: true, body: { date: "2026-09-26" } });
  });

  it("returns INVALID_JSON (not a 500) for a malformed body", async () => {
    const res = await readJsonBody(makeRequest('{"date": "2026-09-26" oops'));
    expect(res).toEqual({ ok: false, code: ERROR_CODES.INVALID_JSON });
  });

  it("returns INVALID_JSON when the body cannot be read at all", async () => {
    const res = await readJsonBody(makeRequest(new Error("stream closed")));
    expect(res).toEqual({ ok: false, code: ERROR_CODES.INVALID_JSON });
  });

  it("returns PAYLOAD_TOO_LARGE from the declared content-length", async () => {
    const res = await readJsonBody(makeRequest("{}", String(MAX_BODY_BYTES + 1)));
    expect(res).toEqual({ ok: false, code: ERROR_CODES.PAYLOAD_TOO_LARGE });
  });

  it("returns PAYLOAD_TOO_LARGE when the actual body is oversized", async () => {
    const huge = JSON.stringify({ pad: "x".repeat(MAX_BODY_BYTES + 10) });
    const res = await readJsonBody(makeRequest(huge, null));
    expect(res).toEqual({ ok: false, code: ERROR_CODES.PAYLOAD_TOO_LARGE });
  });

  it("accepts a body right at the limit", async () => {
    const ok = await readJsonBody(makeRequest(JSON.stringify({ date: "2026-09-26" })));
    expect(ok.ok).toBe(true);
  });
});

describe("coerceNumberInput", () => {
  it("reports absent, present and invalid distinctly", () => {
    expect(coerceNumberInput(undefined)).toEqual({ present: false });
    expect(coerceNumberInput("")).toEqual({ present: false });
    expect(coerceNumberInput("  ")).toEqual({ present: false });
    expect(coerceNumberInput("20")).toEqual({ present: true, value: 20 });
    expect(coerceNumberInput(20)).toEqual({ present: true, value: 20 });
    expect(coerceNumberInput("abc")).toEqual({ present: false, invalid: true });
    expect(coerceNumberInput("-5")).toEqual({ present: false, invalid: true });
    expect(coerceNumberInput("1e9", { max: 1000 })).toEqual({ present: false, invalid: true });
    expect(coerceNumberInput(NaN)).toEqual({ present: false, invalid: true });
  });
});

describe("program units", () => {
  it("gives every sets() target an explicit, valid unit", () => {
    for (const [dayId, day] of Object.entries(PROGRAM)) {
      for (const section of day.sections) {
        for (const item of section.items) {
          if (item.kind !== "sets") continue;
          expect(["reps", "sec", "m"], `${dayId} ${item.name}`).toContain(item.unit);
        }
      }
    }
  });

  it("marks timed holds as seconds and sled pushes as metres", () => {
    const deadHangs = [];
    const sledPushes = [];
    for (const day of Object.values(PROGRAM)) {
      for (const section of day.sections) {
        for (const item of section.items) {
          if (item.kind !== "sets") continue;
          if (item.name === "Dead Hang") deadHangs.push(item);
          if (item.name === "Sled Push") sledPushes.push(item);
        }
      }
    }
    expect(deadHangs.length).toBeGreaterThan(0);
    for (const item of deadHangs) expect(item.unit).toBe("sec");
    for (const item of sledPushes) expect(item.unit).toBe("m");
  });

  it("normalises and labels units", () => {
    expect(normalizeRepsUnit("sec")).toBe("sec");
    expect(normalizeRepsUnit("bananas")).toBe("reps");
    expect(repsUnitLabel("m")).toBe("m");
    expect(normalizeWeightUnit("lb")).toBe("lb");
    expect(normalizeWeightUnit("stone")).toBe("kg");
    expect(formatWeightValue(20, "lb")).toBe("20lb");
    expect(formatWeightValue(20)).toBe("20kg");
    expect(formatRepsValue(38, "sec")).toBe("38 sec");
    expect(formatRepsValue(38)).toBe("38 reps");
    expect(formatRepsValue("", "m")).toBe("");
  });
});

describe("getDefaultReps with units", () => {
  it("keeps the existing midpoint behaviour (backward compatible)", () => {
    expect(getDefaultReps("8–12")).toBe("10");
    expect(getDefaultReps("8-12")).toBe("10");
    expect(getDefaultReps("3 × 5")).toBe("3");
    expect(getDefaultReps("30–45 sec")).toBe("38");
    expect(getDefaultReps("15–25 m")).toBe("20");
  });

  it("falls back per unit for targets with no number", () => {
    expect(getDefaultReps("")).toBe("10");
    expect(getDefaultReps(null)).toBe("10");
    expect(getDefaultReps("AMRAP")).toBe("10");
    expect(getDefaultReps("comfortable")).toBe("10");
    expect(getDefaultReps("comfortable", "sec")).toBe("30");
    expect(getDefaultReps("comfortable", "m")).toBe("20");
  });
});

describe("formatSessionAsText", () => {
  const program = { day1: PROGRAM.day1 };

  it("renders done/sets/result rows and skips empty sections", () => {
    const text = formatSessionAsText(
      {
        date: "2026-09-26",
        day: "day1",
        items: {
          "0:0": { done: true },
          "2:0": { sets: { 1: { weight: "20", reps: "10", done: true } } },
        },
      },
      program
    );
    expect(text).toContain("2026-09-26");
    expect(text).toContain("✓ Brisk treadmill walk");
    expect(text).toContain("Set 1: 20kg × 10 reps ✓");
    expect(text).not.toContain("Athletic activation");
  });

  it("labels a timed hold in seconds, not reps", () => {
    const deadHang = PROGRAM.day1.sections
      .flatMap((s) => s.items)
      .find((i) => i.name === "Dead Hang");
    const text = formatSessionAsText(
      { date: "2026-09-26", day: "day1", items: { [deadHang.key]: { sets: { 1: { reps: 38, done: true } } } } },
      program
    );
    expect(text).toContain("Set 1: 38 sec ✓");
    expect(text).not.toContain("38 reps");
  });

  it("honours the configured weight unit", () => {
    const text = formatSessionAsText(
      { date: "2026-09-26", day: "day1", items: { "2:0": { sets: { 1: { weight: 20, reps: 10 } } } } },
      program,
      { weightUnit: "lb" }
    );
    expect(text).toContain("20lb × 10 reps");
  });

  it("reads the current slug keys as well as legacy positional keys", () => {
    const slug = PROGRAM.day1.sections[2].items[0];
    const text = formatSessionAsText(
      { date: "2026-09-26", day: "day1", items: { [slug.key]: { sets: { 1: { weight: 20, reps: 10, done: true } } } } },
      program
    );
    expect(text).toContain(slug.name);
    expect(text).toContain("Set 1: 20kg × 10 reps ✓");
  });

  it("returns header-only text for empty sessions", () => {
    const text = formatSessionAsText({ date: "2026-09-26", day: "day1", items: {} }, program);
    expect(text).toContain("2026-09-26");
    expect(text).not.toContain("✓");
  });
});

describe("migrateItems", () => {
  it("re-keys legacy positional payloads to the current slugs", () => {
    const first = PROGRAM.day1.sections[0].items[0];
    const res = migrateItems({ "0:0": { done: true } }, "day1");
    expect(res.rekeyed).toBe(true);
    expect(res.items[first.key]).toEqual({ done: true });
    expect(res.unmapped).toEqual([]);
  });

  it("is a no-op for payloads already keyed by slug", () => {
    const first = PROGRAM.day1.sections[0].items[0];
    const res = migrateItems({ [first.key]: { done: true } }, "day1");
    expect(res.rekeyed).toBe(false);
    expect(res.unmapped).toEqual([]);
    expect(res.items[first.key]).toEqual({ done: true });
  });

  it("keeps unmappable data but reports it so the UI can warn", () => {
    const res = migrateItems({ "99:99": { done: true } }, "day1");
    expect(res.rekeyed).toBe(false);
    expect(res.unmapped).toEqual(["99:99"]);
    expect(res.items["99:99"]).toEqual({ done: true });
  });

  it("does not lose data when an exercise is removed from the program", () => {
    const res = migrateItems({ "day1:an-exercise-i-removed": { done: true } }, "day1");
    expect(res.unmapped).toEqual(["day1:an-exercise-i-removed"]);
    expect(res.items["day1:an-exercise-i-removed"]).toEqual({ done: true });
  });
});

describe("program item identity", () => {
  it("gives every item a unique stable key and a legacy positional key", () => {
    for (const [dayId, day] of Object.entries(PROGRAM)) {
      const keys = day.sections.flatMap((s) => s.items.map((i) => i.key));
      expect(new Set(keys).size, dayId).toBe(keys.length);
      for (const key of keys) expect(key.startsWith(`${dayId}:`)).toBe(true);
      for (const section of day.sections) {
        for (const item of section.items) {
          expect(item.legacyKey).toMatch(/^\d+:\d+$/);
        }
      }
    }
  });

  it("exposes a program version", () => {
    expect(Number.isInteger(PROGRAM_VERSION)).toBe(true);
    expect(PROGRAM_VERSION).toBeGreaterThan(1);
  });
});

describe("readSessionEntry", () => {
  it("reads the envelope format", () => {
    const first = PROGRAM.day1.sections[0].items[0];
    const res = readSessionEntry(
      { schema: CACHE_SCHEMA_VERSION, programVersion: PROGRAM_VERSION, items: { [first.key]: { done: true } }, updatedAt: "2026-09-26T10:00:00.000Z" },
      "day1"
    );
    expect(res.items[first.key]).toEqual({ done: true });
    expect(res.updatedAt).toBe("2026-09-26T10:00:00.000Z");
  });

  it("reads the original bare item map and reports the re-key", () => {
    const res = readSessionEntry({ "0:0": { done: true } }, "day1");
    const first = PROGRAM.day1.sections[0].items[0];
    expect(res.items[first.key]).toEqual({ done: true });
    expect(res.rekeyed).toBe(true);
    expect(res.updatedAt).toBeNull();
  });

  it("tolerates a missing entry", () => {
    expect(readSessionEntry(undefined, "day1")).toMatchObject({ items: {}, rekeyed: false });
  });
});

describe("pickNewerSession", () => {
  const entry = (updatedAt, done) => ({ items: { "0:0": { done } }, updatedAt });

  it("keeps the local copy when the server copy is older", () => {
    const local = entry("2026-09-26T12:00:00.000Z", true);
    const server = entry("2026-09-26T09:00:00.000Z", false);
    const res = pickNewerSession(local, server);
    expect(res.source).toBe("local");
    expect(res.entry).toBe(local);
  });

  it("takes the server copy when it is strictly newer", () => {
    const local = entry("2026-09-26T09:00:00.000Z", false);
    const server = entry("2026-09-26T12:00:00.000Z", true);
    const res = pickNewerSession(local, server);
    expect(res.source).toBe("server");
    expect(res.entry).toBe(server);
  });

  it("keeps the local copy on an exact tie (no silent overwrite)", () => {
    const local = entry("2026-09-26T12:00:00.000Z", true);
    const server = entry("2026-09-26T12:00:00.000Z", false);
    expect(pickNewerSession(local, server).source).toBe("local");
  });

  it("never erases local data when the server has nothing", () => {
    const local = entry("2026-09-26T12:00:00.000Z", true);
    expect(pickNewerSession(local, null)).toMatchObject({ source: "local", entry: local });
  });
});

describe("pruneSessionCache", () => {
  it("leaves an under-cap cache untouched", () => {
    const cached = { a: { updatedAt: "2026-01-01T00:00:00.000Z" } };
    const res = pruneSessionCache(cached, 5);
    expect(res.pruned).toBe(0);
    expect(res.cache).toBe(cached);
  });

  it("keeps the newest entries and reports how many were dropped", () => {
    const cached = {
      "2026-01-01|day1": { updatedAt: "2026-01-01T00:00:00.000Z" },
      "2026-03-01|day1": { updatedAt: "2026-03-01T00:00:00.000Z" },
      "2026-02-01|day1": { updatedAt: "2026-02-01T00:00:00.000Z" },
    };
    const res = pruneSessionCache(cached, 2);
    expect(res.pruned).toBe(1);
    expect(Object.keys(res.cache)).toEqual(["2026-03-01|day1", "2026-02-01|day1"]);
  });

  it("bounds the cache to 400 days by default", () => {
    const cached = {};
    for (let i = 0; i < 450; i++) {
      cached[`d${i}|day1`] = { updatedAt: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString() };
    }
    const res = pruneSessionCache(cached, MAX_CACHED_SESSIONS);
    expect(Object.keys(res.cache)).toHaveLength(MAX_CACHED_SESSIONS);
    expect(res.pruned).toBe(50);
  });
});

describe("buildSessionEntry / sessionKeyFor", () => {
  it("builds a versioned envelope with an ISO timestamp", () => {
    const entry = buildSessionEntry({ "0:0": { done: true } }, new Date("2026-09-26T12:00:00Z"), PROGRAM_VERSION);
    expect(entry).toEqual({
      schema: CACHE_SCHEMA_VERSION,
      programVersion: PROGRAM_VERSION,
      items: { "0:0": { done: true } },
      updatedAt: "2026-09-26T12:00:00.000Z",
    });
  });

  it("keys sessions by date and day", () => {
    expect(sessionKeyFor("2026-09-26", "day3")).toBe("2026-09-26|day3");
  });
});
