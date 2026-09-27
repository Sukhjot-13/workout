import { describe, it, expect } from "vitest";
import { hasSessionData, PROGRAM } from "../lib/program.js";
import { formatSessionAsText, getDefaultReps } from "../lib/session-format.js";

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
});

describe("getDefaultReps", () => {
  it("takes the midpoint of ranges (en/em dashes and hyphens)", () => {
    expect(getDefaultReps("8–12")).toBe("10");
    expect(getDefaultReps("8-12")).toBe("10");
    expect(getDefaultReps("3 × 5")).toBe("3");
  });

  it("falls back to 10 for missing/garbage targets", () => {
    expect(getDefaultReps("")).toBe("10");
    expect(getDefaultReps(null)).toBe("10");
    expect(getDefaultReps("AMRAP")).toBe("10");
  });
});

describe("formatSessionAsText", () => {
  const program = {
    day1: PROGRAM.day1,
  };

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
    expect(text).toContain("Set 1: 20 × 10 reps ✓");
    expect(text).not.toContain("Athletic activation");
  });

  it("returns header-only text for empty sessions", () => {
    const text = formatSessionAsText({ date: "2026-09-26", day: "day1", items: {} }, program);
    expect(text).toContain("2026-09-26");
    expect(text).not.toContain("✓");
  });
});
