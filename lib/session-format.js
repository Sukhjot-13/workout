// Pure session-formatting helpers (no React, no DOM — unit-tested).
// Extracted from app/page.js so the export flow is testable.

export const REPS_UNITS = ["reps", "sec", "m"];
export const WEIGHT_UNITS = ["kg", "lb"];

const UNIT_LABEL = { reps: "reps", sec: "sec", m: "m" };
const UNIT_FALLBACK = { reps: "10", sec: "30", m: "20" };

export function normalizeWeightUnit(value) {
  return WEIGHT_UNITS.includes(value) ? value : "kg";
}

export function normalizeRepsUnit(value) {
  return REPS_UNITS.includes(value) ? value : "reps";
}

export function repsUnitLabel(unit) {
  return UNIT_LABEL[normalizeRepsUnit(unit)];
}

export function formatWeightValue(weight, weightUnit = "kg") {
  const unit = normalizeWeightUnit(weightUnit);
  if (weight === undefined || weight === null || weight === "") return "";
  return `${weight}${unit}`;
}

export function formatRepsValue(reps, unit = "reps") {
  if (reps === undefined || reps === null || reps === "") return "";
  return `${reps} ${repsUnitLabel(unit)}`;
}

export function formatSessionAsText(session, program, options = {}) {
  const { date, day, items } = session;
  const programDay = program[day] || program.day1;
  const weightUnit = normalizeWeightUnit(options.weightUnit);
  const lines = [];
  lines.push(`📅 ${date}  •  ${programDay.title}`);
  lines.push(`${programDay.subtitle}`);
  lines.push("");

  programDay.sections.forEach((section) => {
    const sectionLines = [];
    section.items.forEach((item) => {
      // Current payloads key by the stable slug; pre-v2 payloads key by
      // position. Both are read so older sessions still export.
      const saved = items?.[item.key] ?? items?.[item.legacyKey];
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
          if (s.weight) parts.push(formatWeightValue(s.weight, weightUnit));
          if (s.reps) parts.push(formatRepsValue(s.reps, item.unit));
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

export function getDefaultReps(target, unit = "reps") {
  const fallback = UNIT_FALLBACK[normalizeRepsUnit(unit)];
  if (!target) return fallback;
  // Matches "8–12" or "8-12" or "10–15" or "12–20" or "30–45 sec"
  const rangeMatch = target.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    return String(Math.round((min + max) / 2));
  }
  // Single number like "5"
  const singleMatch = target.match(/\d+/);
  if (singleMatch) {
    return singleMatch[0];
  }
  return fallback;
}
