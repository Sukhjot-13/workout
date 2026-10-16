// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkoutPage from "../app/page.js";
import { PROGRAM, PROGRAM_VERSION } from "../lib/program.js";
import { buildSessionEntry, SESSION_CACHE_KEY } from "../lib/session-cache.js";

vi.mock("next/image", () => ({ default: ({ unoptimized, ...props }) => { void unoptimized; return React.createElement("img", props); } }));

async function advance(milliseconds) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T12:00:00"));
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ mongoConnected: false, sessions: [] }) })));
  vi.stubGlobal("requestAnimationFrame", (callback) => setTimeout(callback, 16));
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    return { top: this.id === "exercise-day1:hack-squat" ? 500 : 200, height: 80 };
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("daily resume navigation", () => {
  it("resumes the first unfinished exercise once after loading saved progress", async () => {
    const items = Object.fromEntries(PROGRAM.day1.sections[0].items.map((item) => [item.key, { done: true }]));
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ "2026-10-16|day1": buildSessionEntry(items, new Date(), PROGRAM_VERSION) }));
    render(<WorkoutPage />);
    await advance(0);
    expect(window.scrollTo).not.toHaveBeenCalled();
    await advance(350);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 392, behavior: "instant" });
    fireEvent.change(screen.getByLabelText("Hack Squat (or Goblet Squat) weight, set 1, in kg"), { target: { value: "25" } });
    await advance(1000);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("lets fast day selections finish before automatic scrolling", async () => {
    render(<WorkoutPage />); await advance(0);
    fireEvent.pointerDown(screen.getByRole("tab", { name: /Day 2.*Full Body B/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Day 2.*Full Body B/ }));
    await advance(100);
    expect(window.scrollTo).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByRole("tab", { name: /Day 3.*Full Body C/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Day 3.*Full Body C/ }));
    await advance(0);
    await advance(350);
    expect(screen.getByLabelText("Workout Day").value).toBe("day3");
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("cancels automatic scrolling on interaction while keeping Next available", async () => {
    render(<WorkoutPage />); await advance(0);
    fireEvent.wheel(window);
    await advance(350);
    expect(window.scrollTo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Jump to first unfinished exercise" }));
    await advance(50);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(document.activeElement.id).toBe("exercise-day1:incline-walk");
  });
});
