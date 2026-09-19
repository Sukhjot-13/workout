"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PROGRAM } from "@/lib/program";

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
  const [syncStatus, setSyncStatus] = useState("synced");
  const [mongoStatus, setMongoStatus] = useState({ configured: false, connected: false });
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
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
    let localItems = {};
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed[sessionKey]) {
          localItems = parsed[sessionKey];
        }
      }
    } catch (e) {
      console.warn("Error reading localStorage:", e);
    }
    setItems(localItems);

    let isMounted = true;
    async function fetchServerSession() {
      try {
        const res = await fetch(`/api/session?date=${selectedDate}&day=${selectedDay}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.mongoConnected) {
            setMongoStatus((prev) => ({ ...prev, connected: true, configured: true }));
          }
          if (data.items && Object.keys(data.items).length > 0) {
            setItems(data.items);
            try {
              const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
              cached[sessionKey] = data.items;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
            } catch (err) {}
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
      try {
        const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        cached[sessionKey] = newItems;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
      } catch (e) {}

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
      }, 400);
    },
    [selectedDate, selectedDay]
  );

  const updateItem = (key, updater) => {
    setItems((prev) => {
      const current = prev[key] || {};
      const updated = updater(JSON.parse(JSON.stringify(current)));
      const nextItems = { ...prev, [key]: updated };
      saveSession(nextItems);
      return nextItems;
    });
  };

  const toggleHistory = async () => {
    if (!showHistory) {
      try {
        const res = await fetch("/api/history");
        if (res.ok) {
          const data = await res.json();
          setHistoryList(data.sessions || []);
        }
      } catch (e) {}
    }
    setShowHistory((prev) => !prev);
  };

  const currentProgramDay = PROGRAM[selectedDay] || PROGRAM.day1;

  return (
    <main className="wrap">
      {/* Header */}
      <header className="top-header">
        <div className="top-bar">
          <div>
            <h1>Lean Athletic Workout Tracker</h1>
            <p className="intro">
              3 mandatory gym days + an optional 4th athletic/conditioning day.
            </p>
          </div>

          <div className="header-actions">
            <div
              className={`cloud-badge ${mongoStatus.connected ? "" : "offline"}`}
              title={
                mongoStatus.connected
                  ? "Connected to MongoDB"
                  : "Using local storage. Connect MongoDB in .env for cloud sync."
              }
            >
              <span className="cloud-dot"></span>
              {mongoStatus.connected ? "MongoDB Synced" : "Local Storage"}
            </div>

            <button
              className="history-btn"
              onClick={toggleHistory}
              type="button"
            >
              {showHistory ? "✕ Close Log" : "📜 History"}
            </button>
          </div>
        </div>
      </header>

      {/* History Drawer */}
      {showHistory && (
        <section className="history-drawer">
          <div className="history-drawer-head">
            <h3>Logged Workout Sessions</h3>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
              {historyList.length} session{historyList.length === 1 ? "" : "s"} found
            </span>
          </div>

          {historyList.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
              No previous workouts saved to cloud yet. Complete your first session to view it here!
            </p>
          ) : (
            <div className="history-grid">
              {historyList.map((h, idx) => (
                <button
                  key={idx}
                  className="history-card-btn"
                  onClick={() => {
                    setSelectedDate(h.date);
                    setSelectedDay(h.day);
                    setShowHistory(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <span className="history-date">{h.date}</span>
                  <span className="history-day-title">
                    {PROGRAM[h.day]?.title || h.day}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Controls Bar */}
      <section className="controls" aria-label="Workout selection controls">
        <div className="field">
          <label htmlFor="daySelect">Workout day</label>
          <select
            id="daySelect"
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

        <div className="field">
          <label htmlFor="dateInput">Date</label>
          <input
            id="dateInput"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value || getLocalDateString())}
          />
        </div>

        <div className={`save-pill ${syncStatus === "saving" ? "saving" : ""}`}>
          {syncStatus === "saving" ? "Saving..." : "✓ Auto-saved"}
        </div>
      </section>

      {/* Day Heading */}
      <div className="day-head">
        <h2>{currentProgramDay.title}</h2>
        <p>{currentProgramDay.subtitle}</p>
      </div>

      {/* Sections */}
      {currentProgramDay.sections.map((section, sIdx) => (
        <section key={sIdx} className="section">
          <div className="section-title">
            <h3>{section.title}</h3>
            {section.hint && <span>{section.hint}</span>}
          </div>

          <div className="items">
            {section.items.map((item, iIdx) => {
              const key = `${sIdx}:${iIdx}`;
              const saved = items[key] || {};

              return (
                <div key={key} className="exercise">
                  <div className="exercise-head">
                    <div className="exercise-name">{item.name}</div>
                    {item.prescription && (
                      <div className="prescription">{item.prescription}</div>
                    )}
                    {item.note && <div className="note">{item.note}</div>}
                  </div>

                  {/* Simple Track */}
                  {item.kind === "simple" && (
                    <label className="simple-track">
                      <input
                        type="checkbox"
                        checked={!!saved.done}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateItem(key, (it) => ({ ...it, done: checked }));
                        }}
                      />
                      <span>Complete</span>
                    </label>
                  )}

                  {/* Sets Table */}
                  {item.kind === "sets" && (
                    <div className="set-table">
                      <div className="set-head">
                        <div>Set</div>
                        <div>Weight</div>
                        <div>Reps / time / distance</div>
                        <div>Done</div>
                      </div>

                      {Array.from({ length: item.setCount }, (_, n) => n + 1).map(
                        (setNum) => {
                          const setKey = String(setNum);
                          const setData = (saved.sets || {})[setKey] || {};
                          const disableWeight = item.track === "reps";

                          return (
                            <div key={setNum} className="set-row">
                              <div className="set-no">{setNum}</div>
                              <input
                                type="text"
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

                  {/* Result Grid (Cardio) */}
                  {item.kind === "result" && (
                    <div className="result-grid">
                      <div>
                        <span className="mini">{item.label1}</span>
                        <input
                          type="text"
                          value={saved.value1 || ""}
                          placeholder="e.g. Incline Walk 25m"
                          onChange={(e) => {
                            const val = e.target.value;
                            updateItem(key, (it) => ({ ...it, value1: val }));
                          }}
                        />
                      </div>
                      <div>
                        <span className="mini">{item.label2}</span>
                        <input
                          type="text"
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

      {/* Guidelines Reference Accordion */}
      <section className="reference" aria-label="Reference rules">
        <details>
          <summary>First 4 Weeks — Return-to-Gym Rule</summary>
          <div className="reference-body">
            <p>
              <strong>Weeks 1–2:</strong> Perform 2 working sets of almost every
              exercise. Keep about 3–4 reps in reserve. No failure training.
              Optional Day 4 = walking/cardio + mobility only.
            </p>
            <p>
              <strong>Weeks 3–4:</strong> Move the important exercises to the
              sets listed below. Keep 2–3 reps in reserve. Introduce the light
              athletic/power work.
            </p>
            <p>
              <strong>Week 5 onward:</strong> Run the full program. Most sets
              should finish with around 1–3 good reps still possible. You do not
              need to train to failure to make progress.
            </p>
          </div>
        </details>

        <details>
          <summary>Off Days</summary>
          <div className="reference-body">
            <p>
              I don’t want complete inactivity except where you’re genuinely
              tired. Easy walking is beneficial.
            </p>
            <p>
              A simple target: 20–40 minute walk, plus optionally cat-cow × 8,
              wall slides × 10, hip-flexor stretch, pec stretch, ankle mobility.
              About 5–10 minutes total.
            </p>
          </div>
        </details>

        <details>
          <summary>Cardio Goal</summary>
          <div className="reference-body">
            <p>
              Eventually aim to accumulate roughly 150+ minutes of moderate
              aerobic activity per week, which is consistent with standard adult
              cardiovascular exercise recommendations.
            </p>
            <p>
              Your gym cardio + walks can easily accomplish this. You do not
              have to run. Walking, incline walking, cycling, elliptical and
              rowing all count.
            </p>
          </div>
        </details>

        <details>
          <summary>Posture + Decompression</summary>
          <div className="reference-body">
            <p>
              <strong>3–5 days/week:</strong> Dead hang — 2–3 × 20–45 sec; Wall
              slides — 1–2 × 10; Chin tucks — 1–2 × 10–15; Hip-flexor stretch —
              30–45 sec/side; Pec stretch — 30 sec/side; Thoracic extension —
              8–10 reps.
            </p>
            <p>
              Your strength training already contributes substantially through
              rows, face pulls, Y-raises, serratus work, lower traps, rear
              delts, rotator cuff, core and glutes.
            </p>
          </div>
        </details>

        <details>
          <summary>How to Progress (Double Progression)</summary>
          <div className="reference-body">
            <p>
              Suppose an exercise says 3 × 8–12. Start with a weight you can
              perform for something like 10 / 9 / 8 with clean technique. Over
              the following workouts perhaps 11 / 10 / 9, then 12 / 11 / 10,
              eventually 12 / 12 / 12.
            </p>
            <p>
              Once you hit the top of the range with good form, increase the
              weight slightly and work your way back up. That’s double
              progression.
            </p>
          </div>
        </details>

        <details>
          <summary>Rest Times</summary>
          <div className="reference-body">
            <p>
              <strong>Big exercises:</strong> Squats, RDL, presses, rows,
              pulldowns, hip thrusts, leg press — approximately 2–3 minutes.
            </p>
            <p>
              <strong>Smaller exercises:</strong> Curls, triceps, lateral
              raises, cuff work, calves, forearms — 60–90 seconds.
            </p>
            <p>
              <strong>Athletic work:</strong> Rest enough for the next set to
              remain explosive.
            </p>
          </div>
        </details>
      </section>

      <footer className="footer">
        All entries are automatically synchronized to MongoDB and stored locally on this device.
      </footer>
    </main>
  );
}
