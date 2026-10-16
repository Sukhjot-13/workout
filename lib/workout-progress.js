export function getSetCount(item, saved = {}) {
  saved = saved || {};
  const requested = saved.customSetCount ?? item.setCount;
  return Number.isInteger(requested) ? Math.min(20, Math.max(1, requested)) : item.setCount;
}

export function getItemProgress(item, saved = {}) {
  saved = saved || {};
  if (item.kind !== "sets") return { completed: saved.done ? 1 : 0, total: 1, isComplete: !!saved.done };
  const total = getSetCount(item, saved);
  let completed = 0;
  for (let set = 1; set <= total; set++) if (saved.sets?.[set]?.done) completed++;
  return { completed, total, isComplete: completed === total };
}

export function getDayProgress(day, items = {}) {
  let completed = 0, total = 0;
  for (const section of day?.sections || []) for (const item of section.items) {
    const progress = getItemProgress(item, items[item.key]);
    completed += progress.completed; total += progress.total;
  }
  return { completed, total, percent: total ? Math.round(completed / total * 100) : 0 };
}

export function findFirstUnchecked(day, items = {}) {
  for (const [sectionIndex, section] of (day?.sections || []).entries()) {
    for (const item of section.items) {
      if (!getItemProgress(item, items[item.key]).isComplete) return { key: item.key, sectionIndex };
    }
  }
  return null;
}
