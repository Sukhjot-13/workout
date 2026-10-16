import { coerceNumberInput, MAX_REPS, MAX_WEIGHT } from "./validate.js";

// Keep an in-progress decimal ("20.") as text until blur; coercing it on each
// keystroke makes it impossible to enter fractional plates on mobile.
export function isNumberDraft(value, max = MAX_WEIGHT) {
  return typeof value === "string" && /^\d*(?:\.\d{0,2})?$/.test(value) &&
    (value === "" || value === "." || Number(value) <= max);
}

export function finishNumberDraft(value, max = MAX_WEIGHT) {
  if (value === ".") return "";
  const parsed = coerceNumberInput(value.replace(/\.$/, ""), { max });
  return parsed.present ? parsed.value : "";
}

export function stepValue(value, fallback, delta) {
  const number = Number(value === "" || value == null ? fallback : value);
  return Math.min(MAX_REPS, Math.max(0, (Number.isFinite(number) ? number : 0) + delta));
}

export function applyPreviousSet(item, setNum, previous, track = "weightReps") {
  const fields = {};
  if (track !== "reps" && previous.weight !== undefined) fields.weight = previous.weight;
  if (previous.reps !== undefined) fields.reps = previous.reps;
  return { ...item, sets: { ...item.sets, [setNum]: { ...item.sets?.[setNum], ...fields } } };
}
