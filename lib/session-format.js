// Pure session-formatting helpers (no React, no DOM — unit-tested).
// Extracted from app/page.js so the export flow is testable.

export function formatSessionAsText(session, program) {
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

export function getDefaultReps(target) {
  if (!target) return "10";
  // Matches "8–12" or "8-12" or "10–15" or "12–20"
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
  return "10";
}
