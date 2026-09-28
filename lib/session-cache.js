// Local session cache helpers (pure apart from the localStorage plumbing).
//
// The cache used to be a bare `{ "date|day": items }` map with no timestamp and
// no schema marker, which is why a stale server copy could silently overwrite a
// newer local one. Entries are now envelopes:
//
//   { schema, programVersion, items, updatedAt }
//
// and `pickNewerSession` decides the winner by `updatedAt` instead of by
// arrival order.

import { migrateItems } from "@/lib/program";

export const SESSION_CACHE_KEY = "workout_tracker_local_cache";
export const CACHE_SCHEMA_VERSION = 2;
export const MAX_CACHED_SESSIONS = 400;

export function sessionKeyFor(date, day) {
  return `${date}|${day}`;
}

function storage() {
  try {
    if (typeof globalThis === "undefined" || !globalThis.localStorage) return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readTimestamp(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Reads either the current envelope format or the original bare item map, and
// returns items keyed by the current stable slugs.
export function readSessionEntry(entry, dayId) {
  if (!entry || typeof entry !== "object") {
    return { items: {}, updatedAt: null, programVersion: null, rekeyed: false, unmapped: [] };
  }
  const isEnvelope =
    !!entry.items && typeof entry.items === "object" && !Array.isArray(entry.items);
  const migrated = migrateItems(isEnvelope ? entry.items : entry, dayId);
  return {
    items: migrated.items,
    updatedAt: isEnvelope ? entry.updatedAt ?? null : null,
    programVersion: isEnvelope ? entry.programVersion ?? null : null,
    rekeyed: migrated.rekeyed,
    unmapped: migrated.unmapped,
  };
}

export function buildSessionEntry(items, updatedAt, programVersion) {
  return {
    schema: CACHE_SCHEMA_VERSION,
    programVersion,
    items,
    updatedAt: typeof updatedAt === "string" ? updatedAt : new Date(updatedAt).toISOString(),
  };
}

// A local copy is only replaced when the server copy is strictly newer. An
// absent server copy never erases local data.
export function pickNewerSession(localEntry, serverEntry) {
  if (!localEntry) {
    return { entry: serverEntry || null, source: serverEntry ? "server" : "none" };
  }
  if (!serverEntry) {
    return { entry: localEntry, source: "local" };
  }
  if (readTimestamp(serverEntry.updatedAt) > readTimestamp(localEntry.updatedAt)) {
    return { entry: serverEntry, source: "server" };
  }
  return { entry: localEntry, source: "local" };
}

export function pruneSessionCache(cached, max = MAX_CACHED_SESSIONS) {
  const keys = Object.keys(cached);
  if (keys.length <= max) return { cache: cached, pruned: 0 };

  const ranked = keys.slice().sort((a, b) => {
    const ta = readTimestamp(cached[a]?.updatedAt);
    const tb = readTimestamp(cached[b]?.updatedAt);
    if (ta !== tb) return tb - ta;
    return b.localeCompare(a);
  });
  const keep = new Set(ranked.slice(0, max));

  const next = {};
  let pruned = 0;
  for (const key of keys) {
    if (keep.has(key)) next[key] = cached[key];
    else pruned++;
  }
  return { cache: next, pruned };
}

export function readCache() {
  const store = storage();
  if (!store) return {};
  try {
    const parsed = JSON.parse(store.getItem(SESSION_CACHE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

// Returns { ok, pruned, quotaExceeded } instead of throwing, so callers can
// surface a real error state rather than silently continuing.
export function writeCache(sessionKey, entry, max = MAX_CACHED_SESSIONS) {
  const store = storage();
  if (!store) return { ok: false, pruned: 0, quotaExceeded: false };

  const cached = readCache();
  if (entry === null || entry === undefined) {
    delete cached[sessionKey];
  } else {
    cached[sessionKey] = entry;
  }
  const { cache, pruned } = pruneSessionCache(cached, max);

  try {
    store.setItem(SESSION_CACHE_KEY, JSON.stringify(cache));
    return { ok: true, pruned, quotaExceeded: false };
  } catch (err) {
    const name = err && err.name;
    const quotaExceeded = name === "QuotaExceededError" || (err && err.code === 22);
    if (pruned > 0) {
      try {
        store.setItem(SESSION_CACHE_KEY, JSON.stringify(cache));
        return { ok: true, pruned, quotaExceeded: false };
      } catch (retryErr) {
        return { ok: false, pruned, quotaExceeded: true, error: retryErr };
      }
    }
    return { ok: false, pruned, quotaExceeded, error: err };
  }
}
