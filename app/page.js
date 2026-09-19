"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PROGRAM, hasSessionData } from "@/lib/program";

// ─── Export Utilities ────────────────────────────────────────────────────────

function formatSessionAsText(session, program) {
  const { date, day, items } = session;
  const programDay = program[day] || program.day1;
  const lines = [];
  lines.push(`📅 ${date}  •  ${programDay.title}`);
  lines.push(`${programDay.subtitle}`);
  lines.push("");

  programDay.sections.forEach((section, sIdx) => {
    const sectionLines = [];
    section.items.forEach((item, iIdx) => {
      const key = `${sIdx}:${iIdx}`;
      const saved = items?.[key];
      if (!saved) return;

      if (item.kind === "simple") {
        if (saved.done) sectionLines.push(`  ✓ ${item.name}`);
      } else if (item.kind === "sets") {
        if (!saved.sets) return;
        const setEntries = Object.entries(saved.sets).sort(
          ([a], [b]) => Number(a) - Number(b)
        );
        const anyData = setEntries.some(
          ([, s]) => s.weight || s.reps || s.done
        );
        if (!anyData) return;
        sectionLines.push(`  ${item.name}`);
        setEntries.forEach(([num, s]) => {
          if (!s.weight && !s.reps && !s.done) return;
          const parts = [];
          if (s.weight) parts.push(s.weight);
          if (s.reps) parts.push(`${s.reps} reps`);
          const check = s.done ? "✓" : "○";
          sectionLines.push(`    Set ${num}: ${parts.join(" × ")} ${check}`);
        });
      } else if (item.kind === "result") {
        if (!saved.value1 && !saved.value2) return;
        sectionLines.push(`  ${item.name}`);
        if (saved.value1) sectionLines.push(`    ${item.label1}: ${saved.value1}`);
        if (saved.value2) sectionLines.push(`    ${item.label2}: ${saved.value2}`);
        if (saved.done) sectionLines.push(`    ✓ Done`);
      }
    });

    if (sectionLines.length > 0) {
      lines.push(`── ${section.title} ──`);
      lines.push(...sectionLines);
      lines.push("");
    }
  });

  return lines.join("\n").trimEnd();
}

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

function ExportModal({ onClose, currentSession, historyList, program }) {
  const [scope, setScope] = useState("current");
  const [format, setFormat] = useState("text");

  const hasHistory = historyList && historyList.length > 0;

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
        const text = formatSessionAsText(currentSession, program);
        downloadFile(text, `workout-${currentSession.date}-${currentSession.day}.txt`, "text/plain");
      } else {
        const parts = historyList
          .map((s) => formatSessionAsText(s, program))
          .filter(Boolean)
          .join("\n\n" + "─".repeat(40) + "\n\n");
        downloadFile(parts, `workout-history.txt`, "text/plain");
      }
    }
    onClose();
  }

  return (
    <div className="export-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
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

const STORAGE_KEY = "workout_tracker_local_cache";

function getLocalDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function WorkoutPage() {
  const [selectedDay, setSelectedDay] = useState("day1");
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [items, setItems] = useState({});
  const [syncStatus, setSyncStatus] = useState("synced"); // "synced" | "saving" | "local"
  const [mongoStatus, setMongoStatus] = useState({ configured: false, connected: false });
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [showExport, setShowExport] = useState(false);
  const saveTimeoutRef = useRef(null);

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

  // Load session when date or day changes
  useEffect(() => {
    const sessionKey = `${selectedDate}|${selectedDay}`;
    // 1. Instant load from local storage
    let localItems = {};
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (cached && cached[sessionKey]) {
        localItems = cached[sessionKey];
      }
    } catch (e) {
      console.warn("Error reading localStorage:", e);
    }
    setItems(localItems);

    // 2. Fetch from API (MongoDB)
    let isMounted = true;
    async function fetchServerSession() {
      try {
        const res = await fetch(`/api/session?date=${selectedDate}&day=${selectedDay}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.mongoConnected) {
            setMongoStatus((prev) => ({ ...prev, connected: true, configured: true }));
          }
          if (data.items && hasSessionData(data.items)) {
            setItems(data.items);
            // Update local cache
            try {
              const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
              cached[sessionKey] = data.items;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
            } catch (err) {}
          } else {
            // Server has no active session or it was cleared
            if (!hasSessionData(localItems)) {
              try {
                const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
                delete cached[sessionKey];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
              } catch (err) {}
            }
          }
        }
      } catch (err) {
        console.warn("API session fetch failed, using local cache:", err);
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
      const sessionKey = `${selectedDate}|${selectedDay}`;
      const hasData = hasSessionData(newItems);

      // Save locally immediately or delete from cache if neutral
      try {
        const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        if (hasData) {
          cached[sessionKey] = newItems;
        } else {
          delete cached[sessionKey];
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
      } catch (e) {}

      // Update in-memory history list immediately if history panel is open
      setHistoryList((prev) => {
        if (!hasData) {
          return prev.filter((h) => !(h.date === selectedDate && h.day === selectedDay));
        } else {
          const exists = prev.some((h) => h.date === selectedDate && h.day === selectedDay);
          if (!exists) {
            return [{ date: selectedDate, day: selectedDay }, ...prev];
          }
          return prev;
        }
      });

      setSyncStatus("saving");

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: selectedDate,
              day: selectedDay,
              items: newItems,
            }),
          });
          const result = await res.json();
          if (result.mongoConnected) {
            setMongoStatus((prev) => ({ ...prev, connected: true, configured: true }));
            setSyncStatus("synced");
          } else {
            setSyncStatus("local");
          }
        } catch (err) {
          setSyncStatus("local");
        }
      }, 500);
    },
    [selectedDate, selectedDay]
  );

  // Update an item in the session
  const updateItem = (key, updater) => {
    setItems((prev) => {
      const current = prev[key] || {};
      const updated = updater(JSON.parse(JSON.stringify(current)));
      const nextItems = { ...prev, [key]: updated };
      saveSession(nextItems);
      return nextItems;
    });
  };

  // Load history list
  const loadHistory = async () => {
    let sessions = [];
    let fetchedFromMongo = false;
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        if (data.mongoConnected && Array.isArray(data.sessions)) {
          sessions = data.sessions.filter((s) => hasSessionData(s.items));
          fetchedFromMongo = true;
        }
      }
    } catch (e) {}

    // If MongoDB is not connected or local fallback, read valid sessions from localStorage
    if (!fetchedFromMongo) {
      try {
        const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        sessions = Object.entries(cached)
          .filter(([_, sessionItems]) => hasSessionData(sessionItems))
          .map(([key]) => {
            const [date, day] = key.split("|");
            return { date, day };
          })
          .sort((a, b) => b.date.localeCompare(a.date));
      } catch (e) {}
    }

    setHistoryList(sessions);
  };

  const toggleHistory = () => {
    if (!showHistory) {
      loadHistory();
    }
    setShowHistory((prev) => !prev);
  };

  const currentProgramDay = PROGRAM[selectedDay] || PROGRAM.day1;

  return (
    <main className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-top">
          <div>
            <h1 className="app-title">Lean Athletic Workout Tracker</h1>
            <p className="app-subtitle">
              3 mandatory gym days + an optional 4th athletic/conditioning day.
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
                  : "Using local storage. Add MONGODB_URI to .env to enable cloud sync."
              }
            >
              <span className="status-dot"></span>
              {mongoStatus.connected
                ? "MongoDB Connected"
                : mongoStatus.configured
                ? "Connecting..."
                : "Local Storage (Paste Mongo URL in .env)"}
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

      {/* Export Modal */}
      {showExport && (
        <ExportModal
          onClose={() => setShowExport(false)}
          currentSession={{ date: selectedDate, day: selectedDay, items }}
          historyList={historyList}
          program={PROGRAM}
        />
      )}

      {/* History Drawer / Panel */}
      {showHistory && (
        <section className="history-panel">
          <div className="history-panel-header">
            <h3>Logged Workout History</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                {historyList.length} past sessions recorded
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
          {historyList.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.88rem" }}>
              No previous workouts saved yet. As you log sets, they will appear here.
            </p>
          ) : (
            <div className="history-list">
              {historyList.map((h, idx) => (
                <button
                  key={idx}
                  className="history-item-btn"
                  onClick={() => {
                    setSelectedDate(h.date);
                    setSelectedDay(h.day);
                    setShowHistory(false);
                  }}
                >
                  <span className="history-item-date">{h.date}</span>
                  <span className="history-item-day">
                    {PROGRAM[h.day]?.title || h.day}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

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
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <option value="day1">Day 1 — Full Body A</option>
            <option value="day2">Day 2 — Full Body B</option>
            <option value="day3">Day 3 — Full Body C</option>
            <option value="day4">
              Optional Day 4 — Athleticism + Conditioning
            </option>
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

        <div
          className={`sync-indicator ${
            syncStatus === "saving" ? "saving" : "synced"
          }`}
        >
          {syncStatus === "saving" ? "Saving..." : "✓ Saved"}
        </div>
      </section>

      {/* Day Title */}
      <div className="day-info-card">
        <h2 className="day-info-title">{currentProgramDay.title}</h2>
        <p className="day-info-subtitle">{currentProgramDay.subtitle}</p>
      </div>

      {/* Workout Sections */}
      {currentProgramDay.sections.map((section, sIdx) => (
        <section key={sIdx} className="workout-section">
          <div className="section-header">
            <h3>{section.title}</h3>
            {section.hint && <span className="section-hint">{section.hint}</span>}
          </div>

          <div className="section-items">
            {section.items.map((item, iIdx) => {
              const key = `${sIdx}:${iIdx}`;
              const saved = items[key] || {};

              return (
                <div key={key} className="exercise-box">
                  <div className="exercise-info">
                    <div className="exercise-name">{item.name}</div>
                    {item.prescription && (
                      <div className="exercise-prescription">
                        {item.prescription}
                      </div>
                    )}
                    {item.note && <div className="exercise-note">{item.note}</div>}
                  </div>

                  {/* Simple completion check (warmups / mobility) */}
                  {item.kind === "simple" && (
                    <label className="simple-check-row">
                      <input
                        type="checkbox"
                        checked={!!saved.done}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateItem(key, (it) => ({ ...it, done: checked }));
                        }}
                      />
                      <span className="simple-check-label">Complete</span>
                    </label>
                  )}

                  {/* Sets table */}
                  {item.kind === "sets" && (
                    <div className="sets-container">
                      <div className="sets-header-row">
                        <div style={{ textAlign: "center" }}>Set</div>
                        <div>Weight</div>
                        <div>Reps / Target</div>
                        <div style={{ textAlign: "center" }}>Done</div>
                      </div>

                      {Array.from({ length: item.setCount }, (_, n) => n + 1).map(
                        (setNum) => {
                          const setKey = String(setNum);
                          const setData = (saved.sets || {})[setKey] || {};
                          const disableWeight = item.track === "reps";

                          return (
                            <div key={setNum} className="set-entry-row">
                              <div className="set-number">{setNum}</div>
                              <input
                                type="text"
                                className="set-input"
                                placeholder={disableWeight ? "—" : "Weight"}
                                disabled={disableWeight}
                                value={setData.weight || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateItem(key, (it) => {
                                    const nextSets = { ...(it.sets || {}) };
                                    nextSets[setKey] = {
                                      ...(nextSets[setKey] || {}),
                                      weight: val,
                                    };
                                    return { ...it, sets: nextSets };
                                  });
                                }}
                              />
                              <input
                                type="text"
                                className="set-input"
                                placeholder={item.target || "Reps"}
                                value={setData.reps || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateItem(key, (it) => {
                                    const nextSets = { ...(it.sets || {}) };
                                    nextSets[setKey] = {
                                      ...(nextSets[setKey] || {}),
                                      reps: val,
                                    };
                                    return { ...it, sets: nextSets };
                                  });
                                }}
                              />
                              <input
                                type="checkbox"
                                className="set-checkbox"
                                checked={!!setData.done}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  updateItem(key, (it) => {
                                    const nextSets = { ...(it.sets || {}) };
                                    nextSets[setKey] = {
                                      ...(nextSets[setKey] || {}),
                                      done: checked,
                                    };
                                    return { ...it, sets: nextSets };
                                  });
                                }}
                              />
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}

                  {/* Result / Cardio */}
                  {item.kind === "result" && (
                    <div className="result-container">
                      <div className="result-field">
                        <span className="result-field-label">{item.label1}</span>
                        <input
                          type="text"
                          className="set-input"
                          value={saved.value1 || ""}
                          placeholder="e.g. Incline Walk 25m"
                          onChange={(e) => {
                            const val = e.target.value;
                            updateItem(key, (it) => ({ ...it, value1: val }));
                          }}
                        />
                      </div>
                      <div className="result-field">
                        <span className="result-field-label">{item.label2}</span>
                        <input
                          type="text"
                          className="set-input"
                          value={saved.value2 || ""}
                          placeholder="Notes"
                          onChange={(e) => {
                            const val = e.target.value;
                            updateItem(key, (it) => ({ ...it, value2: val }));
                          }}
                        />
                      </div>
                      <input
                        type="checkbox"
                        className="result-checkbox"
                        checked={!!saved.done}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateItem(key, (it) => ({ ...it, done: checked }));
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Program Guidelines / Reference */}
      <section className="reference-section" aria-label="Reference rules">
        <details>
          <summary>Weekly Layout & Schedule</summary>
          <div className="reference-content">
            <div className="ref-table-wrap">
              <table className="ref-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Training Session</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Monday</strong></td>
                    <td><strong>Day 1 — Full Body A: Squat + Upper Body Foundation</strong></td>
                  </tr>
                  <tr>
                    <td>Tuesday</td>
                    <td>Walking / light cardio / mobility</td>
                  </tr>
                  <tr>
                    <td><strong>Wednesday</strong></td>
                    <td><strong>Day 2 — Full Body B: Posterior Chain + Unilateral</strong></td>
                  </tr>
                  <tr>
                    <td>Thursday</td>
                    <td>Walking / light cardio / mobility</td>
                  </tr>
                  <tr>
                    <td><strong>Friday</strong></td>
                    <td><strong>Day 3 — Full Body C: Complete Physique + Athletic Strength</strong></td>
                  </tr>
                  <tr>
                    <td><strong>Saturday</strong></td>
                    <td><strong>Optional Day 4 — Athletic conditioning + mobility</strong></td>
                  </tr>
                  <tr>
                    <td>Sunday</td>
                    <td>Rest / easy walking</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              You can move the days around. Ideally keep <strong>at least one day between the three main lifting sessions</strong>.
            </p>
          </div>
        </details>

        <details>
          <summary>First 4 Weeks — Return-to-Gym Rule</summary>
          <div className="reference-content">
            <div className="ref-alert-box">
              Because you're coming back after 5–7 months, don't immediately perform the full volume.
            </div>
            <p>
              <strong>Weeks 1–2:</strong> Perform 2 working sets of almost every
              exercise. Keep about 3–4 reps in reserve. No failure training.
              Optional Day 4 = walking/cardio + mobility only.
            </p>
            <p>
              <strong>Weeks 3–4:</strong> Move the important exercises to the
              sets listed in the workout. Keep 2–3 reps in reserve. Introduce the light
              athletic/power work.
            </p>
            <p>
              <strong>Week 5 onward:</strong> Run the full program. Most sets
              should finish with around 1–3 good reps still possible. You do not need
              to train to failure to make progress.
            </p>
          </div>
        </details>

        <details>
          <summary>Off Days</summary>
          <div className="reference-content">
            <p>
              Aim for healthy recovery without complete inactivity (except where you're genuinely tired). Easy walking is beneficial.
            </p>
            <p>
              <strong>Daily Target:</strong> 20–40 minute walk, plus optionally:
            </p>
            <ul>
              <li>Cat-cow &times; 8</li>
              <li>Wall slides &times; 10</li>
              <li>Kneeling hip-flexor stretch</li>
              <li>Doorway pec stretch</li>
              <li>Ankle mobility</li>
            </ul>
            <p>About 5–10 minutes total for mobility.</p>
          </div>
        </details>

        <details>
          <summary>Cardio Goal</summary>
          <div className="reference-content">
            <p>
              Eventually aim to accumulate roughly <strong>150+ minutes of moderate
              aerobic activity per week</strong>, consistent with standard adult
              cardiovascular exercise recommendations.
            </p>
            <p>
              Your gym cardio + walks can easily accomplish this. You do <strong>not</strong> have
              to run. Walking, incline walking, cycling, elliptical, and rowing all count.
            </p>
          </div>
        </details>

        <details>
          <summary>Posture + Decompression Routine</summary>
          <div className="reference-content">
            <p>
              Perform this <strong>3–5 days/week</strong> to stand tall, decompress the spine, and maintain thoracic openness:
            </p>
            <ul>
              <li><strong>Dead hang:</strong> 2–3 &times; 20–45 sec (do not hang painfully or force range)</li>
              <li><strong>Wall slides:</strong> 1–2 &times; 10</li>
              <li><strong>Chin tucks:</strong> 1–2 &times; 10–15</li>
              <li><strong>Hip-flexor stretch:</strong> 30–45 sec/side</li>
              <li><strong>Pec stretch:</strong> 30 sec/side</li>
              <li><strong>Thoracic extension:</strong> 8–10 reps</li>
            </ul>
            <p>
              Your strength training already contributes substantially through rows, face pulls, Y-raises, serratus work, lower traps, rear delts, rotator cuff, core, and glutes. Hanging and posture work help you stand naturally upright and temporarily decompress your spine.
            </p>
          </div>
        </details>

        <details>
          <summary>How to Progress (Double Progression)</summary>
          <div className="reference-content">
            <p>
              Suppose an exercise says <strong>3 &times; 8–12</strong>:
            </p>
            <ol>
              <li>Start with a weight you can perform for <strong>10 / 9 / 8</strong> with clean technique.</li>
              <li>Over following workouts aim for <strong>11 / 10 / 9</strong>, then <strong>12 / 11 / 10</strong>.</li>
              <li>Eventually reach the top of the rep target: <strong>12 / 12 / 12</strong>.</li>
              <li>Once you reach the top of the range with good form across all sets, increase the weight slightly and work your way back up.</li>
            </ol>
            <p>That is double progression—simple, safe, and effective.</p>
          </div>
        </details>

        <details>
          <summary>Rest Times</summary>
          <div className="reference-content">
            <p>
              <strong>Big exercises (2–3 minutes):</strong> Squats, RDL, dumbbell presses, rows,
              pulldowns, hip thrusts, leg press.
            </p>
            <p>
              <strong>Smaller exercises (60–90 seconds):</strong> Curls, triceps, lateral
              raises, cuff work, calves, forearms.
            </p>
            <p>
              <strong>Athletic work:</strong> Rest enough for the next set to remain explosive.
            </p>
          </div>
        </details>

        <details>
          <summary>Complete Body Audit (56 Functions) & Replacement Rule</summary>
          <div className="reference-content">
            <div className="ref-alert-box">
              <strong>The Golden Rule:</strong> If you ever dislike an exercise, don't just delete it. Replace it with an exercise that preserves <strong>exactly the same muscle and function</strong>. That way you maintain complete full-body coverage without creating holes in the plan.
            </div>
            <div className="ref-table-wrap">
              <table className="ref-table">
                <thead>
                  <tr>
                    <th>Region / Function</th>
                    <th style={{ textAlign: "center", width: "120px" }}>Covered</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    "Upper chest",
                    "Mid/general chest",
                    "Lower/sternal chest",
                    "Serratus anterior",
                    "Front delts",
                    "Side delts",
                    "Rear delts",
                    "Rotator cuff",
                    "Scapular stabilizers",
                    "Upper traps",
                    "Middle traps",
                    "Lower traps",
                    "Rhomboids",
                    "Lats",
                    "Teres major",
                    "Spinal erectors",
                    "Biceps",
                    "Brachialis",
                    "Brachioradialis",
                    "All triceps heads",
                    "Forearm flexors",
                    "Forearm extensors",
                    "Pronation/supination",
                    "Grip",
                    "Rectus abs",
                    "Deep core",
                    "Obliques",
                    "Anti-extension",
                    "Anti-rotation",
                    "Anti-lateral flexion",
                    "Glute max",
                    "Glute medius",
                    "Glute minimus",
                    "Quads",
                    "Hamstring hip extension",
                    "Hamstring knee flexion",
                    "Adductors",
                    "Abductors",
                    "Hip flexors",
                    "Gastrocnemius",
                    "Soleus",
                    "Tibialis anterior",
                    "Ankle inversion",
                    "Ankle eversion",
                    "Foot/arch muscles",
                    "Neck flexion",
                    "Neck extension",
                    "Neck lateral flexion",
                    "Neck rotation",
                    "Balance",
                    "Unilateral strength",
                    "Grip/carries",
                    "Explosive power",
                    "Lateral movement",
                    "Coordination",
                    "Aerobic conditioning",
                    "Higher-intensity conditioning",
                    "Flexibility",
                    "Mobility",
                    "Posture",
                    "Spinal decompression",
                  ].map((item, idx) => (
                    <tr key={idx}>
                      <td>{item}</td>
                      <td style={{ textAlign: "center", color: "var(--accent)", fontWeight: 700 }}>
                        {item === "Higher-intensity conditioning" ? "✅ Optional" : "✅"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>

      <footer className="app-footer">
        Personal Workout Tracker &bull; Changes are automatically saved to your
        device and synchronized to MongoDB.
      </footer>
    </main>
  );
}
