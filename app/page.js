"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PROGRAM, PROGRAM_VERSION, hasSessionData, migrateItems } from "@/lib/program";
import {
  WEIGHT_UNITS,
  formatSessionAsText,
  normalizeWeightUnit,
} from "@/lib/session-format";
import {
  MAX_CACHED_SESSIONS,
  buildSessionEntry,
  pickNewerSession,
  mergeSessionHistory,
  readCache,
  readSessionEntry,
  sessionKeyFor,
  writeCache,
} from "@/lib/session-cache";
import SetTracker from "@/components/SetTracker";
import ExerciseGuide from "@/components/ExerciseGuide";
import { createSaveQueue } from "@/lib/session-sync";
import { findFirstUnchecked, getDayProgress, getItemProgress } from "@/lib/workout-progress";

const SAVE_DEBOUNCE_MS = 500;
const WEIGHT_UNIT_STORAGE_KEY = "workout_tracker_weight_unit";
const DAY_STORAGE_KEY = "workout_tracker_selected_day";

// ─── Export Utilities ────────────────────────────────────────────────────────

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Export Modal Component ───────────────────────────────────────────────────

function ExportModal({ onClose, currentSession, historyList, program, weightUnit }) {
  const [scope, setScope] = useState("current");
  const [format, setFormat] = useState("text");
  const dialogRef = useRef(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (node) node.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const hasHistory = historyList && historyList.length > 0;
  const exportOptions = { weightUnit };

  function handleExport() {
    if (format === "json") {
      if (scope === "current") {
        const content = JSON.stringify(currentSession, null, 2);
        downloadFile(content, `workout-${currentSession.date}-${currentSession.day}.json`, "application/json");
      } else {
        const content = JSON.stringify(historyList, null, 2);
        downloadFile(content, `workout-history.json`, "application/json");
      }
    } else {
      // text format
      if (scope === "current") {
        const text = formatSessionAsText(currentSession, program, exportOptions);
        downloadFile(text, `workout-${currentSession.date}-${currentSession.day}.txt`, "text/plain");
      } else {
        const parts = historyList
          .map((s) => formatSessionAsText(s, program, exportOptions))
          .filter(Boolean)
          .join("\n\n" + "─".repeat(40) + "\n\n");
        downloadFile(parts, `workout-history.txt`, "text/plain");
      }
    }
    onClose();
  }

  return (
    <div className="export-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="export-modal-header">
          <p className="export-modal-title" id="export-modal-title">Export Workouts</p>
          <button className="export-modal-close" onClick={onClose} aria-label="Close export">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <p className="export-modal-subtitle">Download your workout data locally.</p>

        <div className="export-scope-row">
          <button
            id="export-scope-current"
            className={`export-scope-btn${scope === "current" ? " active" : ""}`}
            onClick={() => setScope("current")}
          >This Session</button>
          <button
            id="export-scope-history"
            className={`export-scope-btn${scope === "history" ? " active" : ""}`}
            onClick={() => setScope("history")}
            disabled={!hasHistory}
            title={!hasHistory ? "No history available" : undefined}
            style={!hasHistory ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
          >Full History</button>
        </div>

        <div className="export-format-label">Format</div>
        <div className="export-format-cards">
          <button
            id="export-format-text"
            className={`export-format-card${format === "text" ? " selected" : ""}`}
            onClick={() => setFormat("text")}
          >
            <span className="export-format-icon">💬</span>
            <div className="export-format-name">.txt</div>
            <div className="export-format-desc">Readable text — easy to copy &amp; share in a message</div>
          </button>
          <button
            id="export-format-json"
            className={`export-format-card${format === "json" ? " selected" : ""}`}
            onClick={() => setFormat("json")}
          >
            <span className="export-format-icon">🗂️</span>
            <div className="export-format-name">.json</div>
            <div className="export-format-desc">Raw data — full session structure, weights &amp; reps</div>
          </button>
        </div>

        <button id="export-download-btn" className="export-download-btn" onClick={handleExport}>
          ↓ Download {format === "text" ? ".txt" : ".json"}
        </button>
      </div>
    </div>
  );
}

function getLocalDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function triggerHaptic(type = "light") {
  if (typeof window === "undefined" || !window.navigator || !window.navigator.vibrate) return;
  try {
    if (type === "light") {
      window.navigator.vibrate(12);
    } else if (type === "medium") {
      window.navigator.vibrate(26);
    } else if (type === "success") {
      window.navigator.vibrate([18, 40, 24]);
    }
  } catch (e) {}
}

function describeMigration(migrated) {
  const parts = [];
  if (migrated.rekeyed) {
    parts.push("Your logged sets were re-attached to the current exercise list.");
  }
  if (migrated.unmapped.length > 0) {
    parts.push(
      `${migrated.unmapped.length} logged entr${migrated.unmapped.length === 1 ? "y is" : "ies are"} for exercises that are no longer in this program. The data is kept but is not shown below — check the export if you need it.`
    );
  }
  return parts.join(" ");
}

// Runs after mount only: reading localStorage during render would give the
// server and the client different answers and produce ghost chips and
// placeholders that exist in the browser HTML but not in the server HTML.
function findPreviousSession(allPastSessions, selectedDay, selectedDate) {
  if (typeof window === "undefined" || !selectedDate) return null;

  if (Array.isArray(allPastSessions)) {
    const match = allPastSessions.find(
      (s) => s.day === selectedDay && s.date < selectedDate && hasSessionData(s.items)
    );
    if (match) return match;
  }

  const cached = readCache();
  const list = Object.entries(cached)
    .map(([key, entry]) => {
      const [date, day] = key.split("|");
      return { date, day, ...readSessionEntry(entry, day) };
    })
    .filter((s) => s.day === selectedDay && s.date < selectedDate && hasSessionData(s.items))
    .sort((a, b) => b.date.localeCompare(a.date));
  return list.length > 0 ? list[0] : null;
}

// ─── Debounced session sync ─────────────────────────────────────────────────
// One pending-save record per `${date}|${day}`. Keeping the queue outside React
// means a save can be flushed from a debounce timer, a `pagehide` handler or
// the load effect without reading a ref from render scope, and it guarantees
// switching day/date flushes the outgoing session instead of dropping it.
const saveQueue = { activeKey: null, localFailures: new Set(), editVersions: new Map() };
const syncCallbacks = { setSyncStatus: null, setMongoStatus: null };

async function postSession(payload, keepalive) {
  const response = await fetch("/api/session", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), keepalive,
  });
  if (!response.ok) throw new Error(`Session save returned ${response.status}`);
  const result = await response.json();
  if (result.mongoConnected) {
    syncCallbacks.setMongoStatus?.({ connected: true, configured: true });
    return "synced";
  }
  return "local";
}

const sessionSync = createSaveQueue({
  send: postSession,
  onStatus(key, status) {
    if (key !== saveQueue.activeKey) return;
    syncCallbacks.setSyncStatus?.(saveQueue.localFailures.has(key) ? (status === "synced" ? "cloud-only" : "error") : status);
  },
  delay: SAVE_DEBOUNCE_MS,
});
function flushPendingSave(key, keepalive = false) { return sessionSync.flush(key, keepalive); }
function queueSessionSave(date, day, items) {
  sessionSync.queue(sessionKeyFor(date, day), { date, day, items, programVersion: PROGRAM_VERSION });
}
function flushAllPendingSaves() { sessionSync.flushAll(true); }

export default function WorkoutPage() {
  const [selectedDay, setSelectedDay] = useState("day1");
  // Empty on the server and on the first client render, then filled in after
  // mount: a UTC server date would otherwise hydrate east-of-UTC users into
  // yesterday's session.
  const [selectedDate, setSelectedDate] = useState("");
  const [readySession, setReadySession] = useState(null);
  const autoScrollDone = useRef(null);
  const resumeActivity = useRef(0);
  const [items, setItems] = useState({});
  // "synced" | "saving" | "local" | "error"
  const [syncStatus, setSyncStatus] = useState("local");
  const [mongoStatus, setMongoStatus] = useState({ configured: false, connected: false });
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [showExport, setShowExport] = useState(false);
  const [guideItem, setGuideItem] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [allPastSessions, setAllPastSessions] = useState([]);
  const [previousSession, setPreviousSession] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [weightUnit, setWeightUnit] = useState("kg");
  const [toast, setToast] = useState(null);
  const [migrationWarning, setMigrationWarning] = useState(null);
  const showToast = useCallback((message, tone = "warn") => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    syncCallbacks.setSyncStatus = setSyncStatus;
    syncCallbacks.setMongoStatus = setMongoStatus;
    return () => {
      syncCallbacks.setSyncStatus = null;
      syncCallbacks.setMongoStatus = null;
    };
  }, []);

  // Check MongoDB connection status
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        setMongoStatus(data);
      }
    } catch (e) {
      setMongoStatus({ configured: false, connected: false });
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Local-only bootstrap: the date and the weight unit are both
  // browser-local, so they are resolved after mount rather than during render.
  useEffect(() => {
    setSelectedDate(getLocalDateString());
    try {
      const stored = globalThis.localStorage?.getItem(WEIGHT_UNIT_STORAGE_KEY);
      if (stored) setWeightUnit(normalizeWeightUnit(stored));
      const storedDay = globalThis.localStorage?.getItem(DAY_STORAGE_KEY);
      if (Object.hasOwn(PROGRAM, storedDay)) setSelectedDay(storedDay);
    } catch (err) {
      console.warn("Error reading weight unit preference:", err);
    }
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    try { globalThis.localStorage?.setItem(DAY_STORAGE_KEY, selectedDay); }
    catch { /* Session saving separately reports unavailable storage. */ }
  }, [selectedDay, selectedDate]);

  // Never lose an unsaved session to a tab close or bfcache eviction.
  useEffect(() => {
    window.addEventListener("beforeunload", flushAllPendingSaves);
    window.addEventListener("pagehide", flushAllPendingSaves);
    return () => {
      window.removeEventListener("beforeunload", flushAllPendingSaves);
      window.removeEventListener("pagehide", flushAllPendingSaves);
    };
  }, []);

  // Load session when date or day changes
  useEffect(() => {
    function cancelAutomaticResume() {
      autoScrollDone.current = saveQueue.activeKey;
      resumeActivity.current++;
    }
    const events = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((event) => window.addEventListener(event, cancelAutomaticResume, { passive: true }));
    return () => events.forEach((event) => window.removeEventListener(event, cancelAutomaticResume));
  }, []);

  useEffect(() => {
    if (!selectedDate) return undefined;

    const sessionKey = sessionKeyFor(selectedDate, selectedDay);
    setReadySession(null);
    autoScrollDone.current = null;
    const previousKey = saveQueue.activeKey;
    saveQueue.activeKey = sessionKey;
    if (previousKey && previousKey !== sessionKey) {
      // Flush — never discard — the outgoing session's pending save.
      flushPendingSave(previousKey);
    }

    const versionAtLoad = saveQueue.editVersions.get(sessionKey) || 0;
    // 1. Instant load from local storage
    const cached = readCache();
    const local = readSessionEntry(cached[sessionKey], selectedDay);
    const localEntry = {
      items: local.items,
      updatedAt: local.updatedAt,
      programVersion: local.programVersion,
    };
    if (local.rekeyed || local.unmapped.length > 0) {
      setMigrationWarning(describeMigration(local));
    }
    setItems(local.items);
    setMigrationWarning(local.rekeyed || local.unmapped.length ? describeMigration(local) : null);
    setCollapsedSections({});
    setSyncStatus("local");

    // 2. Fetch from API (MongoDB)
    let isMounted = true;
    async function fetchServerSession() {
      try {
        const res = await fetch(
          `/api/session?date=${encodeURIComponent(selectedDate)}&day=${encodeURIComponent(selectedDay)}`,
          { signal: AbortSignal.timeout(6000), cache: "no-store" }
        );
        if (!res.ok || !isMounted) return;
        const data = await res.json();
        if (data.mongoConnected) {
          setMongoStatus((prev) => ({ ...prev, connected: true, configured: true }));
        }
        if (!isMounted || (saveQueue.editVersions.get(sessionKey) || 0) !== versionAtLoad) return;
        setSyncStatus(data.mongoConnected ? "synced" : "local");

        const serverEntry =
          data.items && typeof data.items === "object" && !Array.isArray(data.items)
            ? { items: data.items, updatedAt: data.updatedAt || null, programVersion: data.programVersion ?? null }
            : null;
        const { entry: winner, source } = pickNewerSession(localEntry, serverEntry);

        if (source === "server") {
          // The server copy is genuinely newer, so it wins.
          const merged = migrateItems(winner.items, selectedDay);
          if (!isMounted) return;
          if (merged.rekeyed || merged.unmapped.length > 0) {
            setMigrationWarning(describeMigration(merged));
          }
          setItems(merged.items);
          writeCache(
            sessionKey,
            buildSessionEntry(merged.items, winner.updatedAt || new Date(), winner.programVersion ?? PROGRAM_VERSION)
          );
          return;
        }

        if (!data.mongoConnected) return;

        if (hasSessionData(localEntry.items) || localEntry.updatedAt) {
          // The local copy is newer (or the server has nothing at all) — push
          // it up instead of letting the server overwrite it.
          queueSessionSave(selectedDate, selectedDay, localEntry.items);
        }
      } catch (err) {
        console.warn("API session fetch failed, using local cache:", err);
      } finally {
        if (isMounted) {
          if ((saveQueue.editVersions.get(sessionKey) || 0) !== versionAtLoad) autoScrollDone.current = sessionKey;
          setReadySession(sessionKey);
        }
      }
    }

    fetchServerSession();
    return () => {
      isMounted = false;
    };
  }, [selectedDate, selectedDay]);

  // Debounced auto-save function
  const saveSession = useCallback(
    (newItems) => {
      if (!selectedDate) return;
      const sessionKey = sessionKeyFor(selectedDate, selectedDay);
      const hasData = hasSessionData(newItems);

      const updatedAt = new Date().toISOString();
      saveQueue.editVersions.set(sessionKey, (saveQueue.editVersions.get(sessionKey) || 0) + 1);
      const entry = buildSessionEntry(newItems, updatedAt, PROGRAM_VERSION);
      const write = writeCache(sessionKey, entry);
      if (write.ok) saveQueue.localFailures.delete(sessionKey);
      else saveQueue.localFailures.add(sessionKey);
      queueSessionSave(selectedDate, selectedDay, newItems);

      if (!write.ok) {
        setSyncStatus("error");
        if (write.quotaExceeded) {
          showToast(
            "This device is out of storage. Export your session to keep a backup."
          );
        } else {
          showToast(
            "Couldn't write to this device's storage, so this change isn't saved yet. Export your session to keep a copy."
          );
        }
      } else {
        if (write.pruned > 0) {
          showToast(
            `Local cache trimmed to the ${MAX_CACHED_SESSIONS} most recent sessions.`,
            "info"
          );
        }
        setSyncStatus("saving");
      }

      const patchHistory = (previous) => {
        const remaining = previous.filter((session) => !(session.date === selectedDate && session.day === selectedDay));
        return hasData ? [{ date: selectedDate, day: selectedDay, ...entry }, ...remaining]
          .sort((a, b) => b.date.localeCompare(a.date) || a.day.localeCompare(b.day)) : remaining;
      };
      setHistoryList(patchHistory);
      setAllPastSessions(patchHistory);
    },
    [selectedDate, selectedDay, showToast]
  );

  // Update an item in the session. State first, then side effects (persist +
  // auto-collapse) outside the updater so the updater stays pure and StrictMode
  // never double-fires saves. Event handlers always close over the latest
  // committed `items`.
  const updateItem = (key, updater, sIdx = null) => {
    const current = items[key] || {};
    const updated = updater(JSON.parse(JSON.stringify(current)));
    const nextItems = { ...items, [key]: updated };
    setItems(nextItems);
    saveSession(nextItems);

    if (sIdx !== null) {
      checkAutoCollapse(sIdx, nextItems);
    }
  };

  // Auto-collapse section on finish
  const checkAutoCollapse = (sIdx, currentItems) => {
    const section = currentProgramDay.sections[sIdx];
    if (!section) return;

    const isAllDone = section.items.every((item) => getItemProgress(item, currentItems[item.key]).isComplete);
    const collapsingKey = saveQueue.activeKey;
    const collapsingVersion = saveQueue.editVersions.get(collapsingKey);
    if (isAllDone) {
      triggerHaptic("success");
      setTimeout(() => {
        if (saveQueue.activeKey !== collapsingKey || saveQueue.editVersions.get(collapsingKey) !== collapsingVersion) return;
        setCollapsedSections((prev) => {
          if (prev[sIdx]) return prev;
          return { ...prev, [sIdx]: true };
        });
      }, 650);
    }
  };

  // Toggle section collapse
  const toggleSection = (sIdx) => {
    triggerHaptic("light");
    setCollapsedSections((prev) => ({
      ...prev,
      [sIdx]: !prev[sIdx],
    }));
  };

  // Load history list and past sessions for ghost values
  const loadHistory = useCallback(async (silent = true) => {
    setHistoryLoading(true);
    let serverSessions = [];
    try {
      const res = await fetch("/api/history", { signal: AbortSignal.timeout(6000), cache: "no-store" });
      if (!res.ok) throw new Error(`History returned ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.sessions)) serverSessions = data.sessions;
    } catch (error) {
      console.warn("Cloud history unavailable:", error);
      if (!silent) showToast("Cloud history unavailable. Showing sessions saved on this device.");
    } finally {
      const sessions = mergeSessionHistory(serverSessions, readCache());
      setHistoryList(sessions);
      setAllPastSessions(sessions);
      setHistoryLoading(false);
    }
  }, [showToast]);

  // History is loaded once on mount, not on every date/day change: each load
  // used to mean a full history query from Mongo.
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Most recent previous session for progressive overload ghost values.
  // Resolved in an effect so the server render and the first client render
  // agree that there is no ghost session yet.
  useEffect(() => {
    setPreviousSession(findPreviousSession(allPastSessions, selectedDay, selectedDate));
  }, [allPastSessions, selectedDay, selectedDate]);

  const toggleHistory = () => {
    if (!showHistory) {
      loadHistory(false);
    }
    setShowHistory((prev) => !prev);
  };

  const currentProgramDay = PROGRAM[selectedDay] || PROGRAM.day1;

  const jumpToFirstUnchecked = useCallback((focus = false) => {
    const target = findFirstUnchecked(PROGRAM[selectedDay], items);
    if (!target) {
      if (focus) showToast("Everything is complete for this workout.", "info");
      return;
    }
    const sessionKey = sessionKeyFor(selectedDate, selectedDay);
    setCollapsedSections((previous) => ({ ...previous, [target.sectionIndex]: false }));
    const activityAtStart = resumeActivity.current;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (saveQueue.activeKey !== sessionKey) return;
      if (!focus && resumeActivity.current !== activityAtStart) return;
      const element = document.getElementById(`exercise-${target.key}`);
      const controls = document.querySelector(".controls-bar");
      if (!element) return;
      const offset = (controls?.getBoundingClientRect().height || 90) + 28;
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: focus && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant" });
      if (focus) element.focus({ preventScroll: true });
    }));
  }, [items, selectedDate, selectedDay, showToast]);

  useEffect(() => {
    const key = sessionKeyFor(selectedDate, selectedDay);
    if (!selectedDate || readySession !== key || autoScrollDone.current === key) return;
    // Let a day/date interaction finish before moving its controls out of view.
    // Any further interaction cancels this pending resume via the listener above.
    const activityAtStart = resumeActivity.current;
    const timer = setTimeout(() => {
      if (resumeActivity.current !== activityAtStart) return;
      autoScrollDone.current = key;
      jumpToFirstUnchecked();
    }, 300);
    return () => clearTimeout(timer);
  }, [readySession, selectedDate, selectedDay, jumpToFirstUnchecked]);

  const dayProgress = getDayProgress(currentProgramDay, items);
  const totalSetsInDay = dayProgress.total;
  const completedSetsInDay = dayProgress.completed;
  const progressPercent = dayProgress.percent;

  const syncIndicatorClass =
    syncStatus === "saving"
      ? "saving"
      : syncStatus === "synced"
      ? "synced"
      : syncStatus === "error"
      ? "error"
      : "local";
  const syncIndicatorText =
    syncStatus === "saving"
      ? "Saving..."
      : syncStatus === "error"
      ? "Sync failed · export a backup or retry"
      : syncStatus === "local"
      ? "Saved on this device only"
      : syncStatus === "cloud-only"
      ? "Saved to cloud · device storage unavailable"
      : "✓ Saved to cloud";

  return (
    <main className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-top">
          <div>
            <h1 className="app-title">Lean Athletic Workout Tracker</h1>
            <p className="app-subtitle">
              Three days. A stronger, more balanced you.
            </p>
          </div>

          <div className="header-badges">
            <span
              className={`status-badge ${
                mongoStatus.connected
                  ? "connected"
                  : mongoStatus.configured
                  ? "saving"
                  : "local"
              }`}
              title={
                mongoStatus.connected
                  ? "Connected to MongoDB"
                  : mongoStatus.configured
                  ? "Connecting to MongoDB..."
                  : "Workouts are saved in this browser. Export a backup anytime."
              }
            >
              <span className="status-dot"></span>
              {mongoStatus.connected
                ? "MongoDB Connected"
                : mongoStatus.configured
                ? "Cloud unavailable"
                : "Saved on this device"}
            </span>

            <button
              className="history-toggle-btn"
              onClick={toggleHistory}
              type="button"
            >
              {showHistory ? "Close History" : "Workout History"}
            </button>

            <button
              id="header-export-btn"
              className="export-btn"
              onClick={() => setShowExport(true)}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </button>
          </div>
        </div>
      </header>

      {guideItem && <ExerciseGuide key={guideItem.key} item={guideItem} onClose={() => setGuideItem(null)} />}

      {/* Export Modal */}
      {showExport && (
        <ExportModal
          onClose={() => setShowExport(false)}
          currentSession={{ date: selectedDate, day: selectedDay, items }}
          historyList={historyList}
          program={PROGRAM}
          weightUnit={weightUnit}
        />
      )}

      {toast && (
        <div
          className="save-toast"
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "20px",
            transform: "translateX(-50%)",
            zIndex: 200,
            maxWidth: "min(92vw, 420px)",
            padding: "12px 16px",
            borderRadius: "10px",
            fontSize: "0.85rem",
            lineHeight: 1.4,
            background: "var(--card-elevated, #16181d)",
            border: `1px solid ${toast.tone === "info" ? "rgba(56, 189, 248, 0.4)" : "rgba(248, 113, 113, 0.45)"}`,
            color: toast.tone === "info" ? "#7dd3fc" : "#fca5a5",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45)",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* History Drawer / Panel */}
      {showHistory && (
        <section className="history-panel">
          <div className="history-panel-header">
            <h3>Logged Workout History</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                {historyLoading ? "Loading sessions…" : `${historyList.length} sessions recorded`}
              </span>
              {historyList.length > 0 && (
                <button
                  id="history-export-btn"
                  className="export-btn"
                  onClick={() => setShowExport(true)}
                  type="button"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export
                </button>
              )}
            </div>
          </div>
          {historyLoading ? <p role="status" className="muted">Loading workout history…</p> : historyList.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.88rem" }}>
              No previous workouts saved yet. As you log sets, they will appear here.
            </p>
          ) : (
            <div className="history-list">
              {historyList.map((h) => (
                <button
                  key={sessionKeyFor(h.date, h.day)}
                  className="history-item-btn"
                  onClick={() => {
                    if (!PROGRAM[h.day]) {
                      downloadFile(formatSessionAsText(h, PROGRAM, { weightUnit }), `workout-${h.date}-${h.day}.txt`, "text/plain");
                      showToast("Archived session downloaded.", "info");
                      return;
                    }
                    setSelectedDate(h.date);
                    setSelectedDay(h.day);
                    setShowHistory(false);
                  }}
                >
                  <span className="history-item-date">{h.date}</span>
                  <span className="history-item-day">
                    {PROGRAM[h.day]?.title || "Archived session · download ↗"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Quick Day Switcher Tabs */}
      <nav className="day-tabs-bar" role="tablist" aria-label="Workout Days">
        {[
          { id: "day1", label: "Day 1", name: "Full Body A" },
          { id: "day2", label: "Day 2", name: "Full Body B" },
          { id: "day3", label: "Day 3", name: "Full Body C" },
        ].map((d) => (
          <button
            key={d.id}
            id={`day-tab-${d.id}`}
            type="button"
            role="tab"
            aria-selected={selectedDay === d.id}
            aria-controls="workout-tabpanel"
            tabIndex={selectedDay === d.id ? 0 : -1}
            className={`day-tab-btn ${selectedDay === d.id ? "active" : ""}`}
            onClick={() => {
              setSelectedDay(d.id);
            }}
          >
            <span className="day-tab-label">{d.label}</span>
            <span className="day-tab-name">{d.name}</span>
          </button>
        ))}
      </nav>

      {/* Sticky Day & Date Controls */}
      <section className="controls-bar" aria-label="Workout selection controls">
        <div className="control-field">
          <label className="control-label" htmlFor="day-select">
            Workout Day
          </label>
          <select
            id="day-select"
            className="control-select"
            value={selectedDay}
            onChange={(e) => {
              setSelectedDay(e.target.value);
            }}
          >
            <option value="day1">Day 1 — Full Body A</option>
            <option value="day2">Day 2 — Full Body B</option>
            <option value="day3">Day 3 — Full Body C</option>
          </select>
        </div>

        <div className="control-field">
          <label className="control-label" htmlFor="date-select">
            Date
          </label>
          <input
            id="date-select"
            type="date"
            className="control-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value || getLocalDateString())}
          />
        </div>

        <div className="control-field">
          <label className="control-label" htmlFor="weight-unit-select">
            Weight Unit
          </label>
          <select
            id="weight-unit-select"
            className="control-select"
            value={weightUnit}
            onChange={(e) => {
              const next = normalizeWeightUnit(e.target.value);
              setWeightUnit(next);
              try {
                globalThis.localStorage?.setItem(WEIGHT_UNIT_STORAGE_KEY, next);
              } catch (err) {
                console.warn("Error saving weight unit preference:", err);
              }
            }}
          >
            {WEIGHT_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>

        <div
          className={`sync-indicator ${syncIndicatorClass}`}
          role="status"
          aria-live="polite"
        >
          {syncIndicatorText}
          {syncStatus === "error" && <button type="button" className="retry-save-button" onClick={() => saveSession(items)}>Retry save</button>}
        </div>
        <button type="button" className="jump-next-button" aria-label="Jump to first unfinished exercise" onClick={() => jumpToFirstUnchecked(true)}>
          {progressPercent === 100 ? "Done ✓" : "Next ↓"}
        </button>
      </section>

      {migrationWarning && (
        <div
          className="migration-warning"
          role="status"
          aria-live="polite"
          style={{
            margin: "0 0 16px",
            padding: "12px 14px",
            borderRadius: "10px",
            fontSize: "0.85rem",
            lineHeight: 1.45,
            background: "rgba(250, 204, 21, 0.08)",
            border: "1px solid rgba(250, 204, 21, 0.35)",
            color: "#fde68a",
          }}
        >
          <strong>Program changed.</strong> {migrationWarning}
        </div>
      )}

      <div
        id="workout-tabpanel"
        role="tabpanel"
        aria-labelledby={`day-tab-${selectedDay}`}
        tabIndex={-1}
      >
      {/* Day Title & Progress Card */}
      <div className="day-info-card">
        <div className="day-info-main">
          <h2 className="day-info-title">{currentProgramDay.title}</h2>
          <p className="day-info-subtitle">{currentProgramDay.subtitle}</p>
        </div>
        <div className="day-progress-wrap">
          <div className="day-progress-header">
            <span className="day-progress-label">Today’s Progress</span>
            <span className="day-progress-stat">
              <strong>{completedSetsInDay}</strong> / {totalSetsInDay} completed ({progressPercent}%)
            </span>
          </div>
          <div
            className="day-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-valuetext={`${completedSetsInDay} of ${totalSetsInDay} sets completed`}
            aria-label="Today's workout progress"
          >
            <div
              className={`day-progress-bar ${progressPercent === 100 ? "all-done" : ""}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {!selectedDate && <p role="status">Loading your workout…</p>}
      <fieldset className="workout-fields" disabled={!selectedDate}>
      <div className="workout-resume-bar">
        <span>Pick up where you left off. Guides stay hidden until opened.</span>
      </div>
      {/* Workout Sections */}
      {currentProgramDay.sections.map((section, sIdx) => {
        const isCollapsed = !!collapsedSections[sIdx];

        const sectionDoneCount = section.items.filter((item) => getItemProgress(item, items[item.key]).isComplete).length;
        const isSectionComplete = sectionDoneCount === section.items.length;

        return (
          <section key={sIdx} className="workout-section">
            <button
              type="button"
              className="section-header clickable"
              onClick={() => toggleSection(sIdx)}
              aria-expanded={!isCollapsed}
              aria-controls={`section-items-${sIdx}`}
              title={isCollapsed ? "Click to expand" : "Click to collapse"}
            >
              <span className="section-header-title-wrap">
                <span className={`section-collapse-chevron ${isCollapsed ? "collapsed" : ""}`}>
                  ▼
                </span>
                <h3>{section.title}</h3>
                {section.hint && <span className="section-hint">{section.hint}</span>}
              </span>

              <span className="section-header-badge-wrap">
                <span className={`section-status-badge ${isSectionComplete ? "completed" : ""}`}>
                  {isSectionComplete ? "✓ Complete" : `${sectionDoneCount}/${section.items.length}`}
                </span>
              </span>
            </button>

            {!isCollapsed && (
              <div className="section-items" id={`section-items-${sIdx}`}>
                {section.items.map((item) => {
                  const key = item.key;
                  const saved = items[key] || {};
                  const prevItem = previousSession?.items?.[key] ?? previousSession?.items?.[item.legacyKey];

                  return (
                    <div key={key} id={`exercise-${key}`} tabIndex={-1} className="exercise-box">
                      <div className="exercise-info">
                        <div className="exercise-heading">
                          <div className="exercise-name">{item.name}</div>
                          <button type="button" className="form-guide-button" onClick={() => setGuideItem(item)}
                            aria-haspopup="dialog" aria-label={`Open form guide for ${item.name}`}>↗ Form guide</button>
                        </div>
                        {item.prescription && (
                          <div className="exercise-prescription">
                            {item.prescription}
                          </div>
                        )}
                        {item.note && <div className="exercise-note">{item.note}</div>}
                      </div>

                      {/* Simple completion check (warmups / mobility) */}
                      {item.kind === "simple" && (
                        <div
                          className={`simple-check-row ${saved.done ? "is-done" : ""}`}
                          onClick={() => {
                            triggerHaptic("medium");
                            const nextDone = !saved.done;
                            updateItem(key, (it) => ({ ...it, done: nextDone }), sIdx);
                          }}
                        >
                          <button
                            type="button"
                            className={`set-done-btn ${saved.done ? "is-done" : ""}`}
                            aria-label={`Mark ${item.name} ${saved.done ? "incomplete" : "complete"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic("medium");
                              const nextDone = !saved.done;
                              updateItem(key, (it) => ({ ...it, done: nextDone }), sIdx);
                            }}
                          >
                            {saved.done ? (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <span className="set-done-circle" />
                            )}
                          </button>
                          <span className="simple-check-label">
                            {saved.done ? "✓ Completed" : "Mark as completed"}
                          </span>
                        </div>
                      )}

                      {item.kind === "sets" && <SetTracker item={item} saved={saved} previous={prevItem}
                        weightUnit={weightUnit} onUpdate={(updater) => updateItem(key, updater, sIdx)} />}

                      {/* Result / Cardio */}
                      {item.kind === "result" && (
                        <div className={`result-container ${saved.done ? "is-done" : ""}`}>
                          <div className="result-field">
                            <span className="result-field-label">{item.label1}</span>
                            <input
                              type="text"
                              maxLength={500}
                              className="set-input"
                              aria-label={`${item.name} — ${item.label1}`}
                              value={saved.value1 || ""}
                              placeholder="e.g. Incline Walk 25m"
                              onChange={(e) => {
                                const val = e.target.value;
                                updateItem(key, (it) => ({ ...it, value1: val }), sIdx);
                              }}
                            />
                          </div>
                          <div className="result-field">
                            <span className="result-field-label">{item.label2}</span>
                            <input
                              type="text"
                              maxLength={500}
                              className="set-input"
                              aria-label={`${item.name} — ${item.label2}`}
                              value={saved.value2 || ""}
                              placeholder="Notes / speed / incline"
                              onChange={(e) => {
                                const val = e.target.value;
                                updateItem(key, (it) => ({ ...it, value2: val }), sIdx);
                              }}
                            />
                          </div>
                          <div className="result-done-col">
                            <button
                              type="button"
                              className={`set-done-btn ${saved.done ? "is-done" : ""}`}
                              aria-label={`Mark ${item.name} ${saved.done ? "incomplete" : "complete"}`}
                              onClick={() => {
                                triggerHaptic("medium");
                                const nextDone = !saved.done;
                                updateItem(key, (it) => ({ ...it, done: nextDone }), sIdx);
                              }}
                            >
                              {saved.done ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <span className="set-done-circle" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      </fieldset>
      </div>

      <section className="reference-section" aria-label="Program notes">
        <details><summary>Weekly rhythm & progression</summary><div className="reference-content">
          <p><strong>Monday: Full Body A · Wednesday: Full Body B · Friday: Full Body C</strong></p>
          <p>Move the days to suit your schedule, leaving a recovery day between lifting sessions.</p>
          <p>When all working sets reach the top of the rep range with controlled form, increase the weight slightly and build up again.</p>
          <p>For a 2–3 or 1–2 set prescription, use Remove set to choose the lower end. For per-side work, complete both sides before checking off one set.</p>
        </div></details>
        <details><summary>Cardio & finishing work</summary><div className="reference-content">
          <p>Finish with 20–25 minutes of steady incline walking, cycling or elliptical at a conversational pace.</p>
          <p>On Day 3, after rebuilding conditioning, you can instead do five rounds of 1 minute moderately hard and 2 minutes easy on the bike or elliptical (15 minutes).</p>
          <p>Dead hangs and stretches are listed at the end of each day. Day 3 also includes the short neck, ankle and arch resilience block.</p>
        </div></details>
        <details><summary>Using your tracker</summary><div className="reference-content">
          <p>Enter weights and reps, then check off each set. A placeholder is a suggestion until you enter it or mark the set complete. Set 1 weight fills empty, unfinished sets.</p>
          <p>Use last copies the previous workout’s values for that set. Form guide opens the illustration and technique cues; images stay hidden until you ask for them.</p>
          <p>Your entries save on this device immediately. Cloud status shows when syncing is available. Export a backup from the top of the page; older removed exercises remain in your exports.</p>
        </div></details>
      </section>

      <footer className="app-footer">
        Personal Workout Tracker &bull; Changes are automatically saved to your
        device and synchronized to MongoDB.
      </footer>
    </main>
  );
}
