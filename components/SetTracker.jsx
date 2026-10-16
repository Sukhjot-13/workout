"use client";

import NumericInput from "./NumericInput";
import { getSetCount } from "@/lib/workout-progress";
import { applyPreviousSet, stepValue } from "@/lib/workout-input";
import { formatRepsValue, formatWeightValue, getDefaultReps } from "@/lib/session-format";

export default function SetTracker({ item, saved, previous, weightUnit, onUpdate }) {
  const count = getSetCount(item, saved);
  const unit = item.unit || "reps";
  const defaultReps = getDefaultReps(item.target, unit);
  const weighted = item.track !== "reps";
  function changeSet(setNum, fields) {
    onUpdate((current) => ({ ...current, sets: { ...current.sets, [setNum]: { ...current.sets?.[setNum], ...fields } } }));
  }
  function changeWeight(setNum, weight) {
    onUpdate((current) => {
      const nextSets = { ...current.sets };
      const oldWeight = nextSets[setNum]?.weight ?? "";
      nextSets[setNum] = { ...nextSets[setNum], weight };
      if (setNum === 1) {
        for (let index = 2; index <= count; index++) {
          const existing = nextSets[index] || {};
          if (!existing.done && (existing.weight === undefined || existing.weight === "" || existing.weight === oldWeight)) {
            nextSets[index] = { ...existing, weight };
          }
        }
      }
      return { ...current, sets: nextSets };
    });
  }
  function changeCount(delta) {
    onUpdate((current) => {
      const nextCount = Math.min(20, Math.max(1, count + delta));
      // Retain hidden set data so an accidental tap can be undone with Add Set.
      return { ...current, customSetCount: nextCount };
    });
  }
  return (
    <div className={`sets-container${weighted ? "" : " bodyweight-sets"}`}>
      <div className="sets-header-row">
        <div>Set</div>{weighted && <div>Weight <span className="muted">({weightUnit})</span></div>}
        <div className="reps-header-cell"><span>{unit === "sec" ? "Seconds" : "Reps"}</span><span className="target-pill">{item.target}</span></div>
        <div>Done</div>
      </div>
      {Array.from({ length: count }, (_, index) => index + 1).map((setNum) => {
        const data = saved.sets?.[setNum] || {};
        const last = previous?.sets?.[setNum];
        return <div key={setNum} className={`set-entry-row${data.done ? " is-done" : ""}`}>
          <span className="set-number">{setNum}</span>
          {weighted && <div className="set-input-wrap"><NumericInput className="set-input weight-input"
            aria-label={`${item.name} weight, set ${setNum}, in ${weightUnit}`}
            value={data.weight} placeholder={last?.weight !== undefined ? String(last.weight) : weightUnit}
            onChange={(value) => changeWeight(setNum, value)} /></div>}
          <div className="reps-stepper-wrap">
            <div className="reps-stepper">
              <button type="button" className="stepper-btn" aria-label={`Decrease ${unit} for ${item.name}, set ${setNum}`}
                onClick={() => changeSet(setNum, { reps: stepValue(data.reps, defaultReps, -1) })}>−</button>
              <NumericInput className="set-input reps-input" max={10000} value={data.reps}
                aria-label={`${item.name} ${unit}, set ${setNum}`} placeholder={String(last?.reps ?? defaultReps)}
                onChange={(value) => changeSet(setNum, { reps: value })} />
              <button type="button" className="stepper-btn" aria-label={`Increase ${unit} for ${item.name}, set ${setNum}`}
                onClick={() => changeSet(setNum, { reps: stepValue(data.reps, defaultReps, 1) })}>+</button>
            </div>
            {last && (last.weight !== undefined || last.reps !== undefined) && <button type="button" className="prev-ghost-chip"
              title="Copy previous values for this set" onClick={() => onUpdate((current) => applyPreviousSet(current, setNum, last, item.track))}>
              ↶ Use last: {[weighted ? formatWeightValue(last.weight, weightUnit) : "", formatRepsValue(last.reps, unit)].filter(Boolean).join(" × ")}
            </button>}
          </div>
          <button type="button" className={`set-done-btn${data.done ? " is-done" : ""}`} aria-pressed={!!data.done}
            aria-label={`Mark ${item.name} set ${setNum} ${data.done ? "incomplete" : "complete"}`}
            onClick={() => changeSet(setNum, { done: !data.done, ...(data.done || data.reps !== undefined && data.reps !== "" ? {} : { reps: Number(defaultReps) }) })}>
            {data.done ? "✓" : <span className="set-done-circle" />}
          </button>
        </div>;
      })}
      <div className="sets-action-bar">
        <button type="button" className="set-action-btn add-set-btn" disabled={count >= 20} onClick={() => changeCount(1)}>+ Add set</button>
        <button type="button" className="set-action-btn remove-set-btn" title="Hide the last set; Add set restores its values" disabled={count <= 1} onClick={() => changeCount(-1)}>− Remove set</button>
        <span className="entry-hint">{weighted ? "Set 1 weight fills empty sets." : "No weight needed."} Check off each set.</span>
      </div>
    </div>
  );
}
