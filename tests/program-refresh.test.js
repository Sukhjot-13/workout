import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PROGRAM, PROGRAM_VERSION, getProgramDay, getItemByLegacyKey, migrateItems } from "../lib/program.js";
import { EXERCISE_GUIDES, getExerciseGuide } from "../lib/exercise-guides.js";
import { findFirstUnchecked, getDayProgress, getItemProgress, getSetCount } from "../lib/workout-progress.js";
import { formatSessionAsText } from "../lib/session-format.js";
import { mergeSessionHistory } from "../lib/session-cache.js";
import { isDateKey } from "../lib/validate.js";

const allItems = (day) => PROGRAM[day].sections.flatMap((section) => section.items);
const item = (day, id) => allItems(day).find((exercise) => exercise.id === id);

describe("the replacement program", () => {
  it("contains precisely three days and the supplied number of exercises", () => {
    expect(Object.keys(PROGRAM)).toEqual(["day1", "day2", "day3"]);
    expect(PROGRAM_VERSION).toBe(3);
    expect([allItems("day1").length, allItems("day2").length, allItems("day3").length]).toEqual([23,25,28]);
    expect(getProgramDay("day4")).toBeNull();
  });
  it("uses the new strength, arm, core and timed prescriptions", () => {
    expect(item("day1", "hack-squat")).toMatchObject({ setCount:3, target:"6–10" });
    expect(item("day1", "rope-pushdown").setCount).toBe(3);
    expect(item("day1", "dead-bug").target).toBe("8–10/side");
    expect(item("day2", "seated-row").target).toBe("10–15");
    expect(item("day2", "internal-rotation").prescription).toContain("1–2");
    expect(item("day3", "leg-press")).toMatchObject({setCount:3,target:"10–12"});
    expect(item("day3", "overhead-triceps").setCount).toBe(3);
    expect(item("day2", "side-plank").prescription).toBe("2 × 30–45 sec/side");
    expect(item("day3", "short-foot").prescription).toBe("2 × 20–30 sec/foot");
    for (const id of ["neck-isometrics","short-foot","suitcase","dead-hang"]) expect(item("day3",id).unit).toBe("sec");
    expect(item("day3","cardio").prescription).toContain("5 × (1 min moderately hard + 2 min easy)");
  });
  it("matches the complete ordered movement list for each day", () => {
    expect(allItems("day1").map((i)=>i.id)).toEqual(["incline-walk","ankle-rocks","wall-slides","band-pull-apart","bodyweight-squat","hack-squat","incline-db-press","supported-row","rdl","neutral-pulldown","cable-lateral","rope-pushdown","incline-curl","standing-calf","tibialis","pallof","dead-bug","farmer","cardio","dead-hang","doorway-stretch","hip-flexor-stretch","calf-stretch"]);
    expect(allItems("day2").map((i)=>i.id)).toEqual(["bike-elliptical","hip-90-90","elephant-walk","band-external-rotation","glute-bridge","bulgarian","hip-thrust","landmine-press","pulldown-assisted","seated-row","leg-curl","hip-abduction","hip-adduction","face-pull","external-rotation","internal-rotation","seated-calf","psoas","side-plank","bird-dog","cardio","dead-hang","thoracic-extension","hamstring-stretch","hip-flexor-stretch"]);
    expect(allItems("day3").map((i)=>i.id)).toEqual(["treadmill-rower","reverse-lunge","wall-slides","push-up-plus","light-face-pull","leg-press","flat-db-press","one-arm-cable-row","back-extension","high-low-fly","reverse-cable-fly","y-raise","db-shrug","hammer-curl","overhead-triceps","wrist-curl","pronation","knee-raise","suitcase","neck-isometrics","ankle-inversion-eversion","short-foot","cardio","dead-hang","child-side-reach","doorway-stretch","hamstring-stretch","hip-flexor-stretch"]);
  });
  it("gives every movement its own existing image, without combined sheets", () => {
    expect(Object.keys(EXERCISE_GUIDES)).toHaveLength(66);
    const imagePaths = new Set();
    for (const exercise of Object.values(PROGRAM).flatMap((day)=>day.sections.flatMap((section)=>section.items))) {
      const guide = getExerciseGuide(exercise.guideId);
      expect(guide, exercise.name).toBeTruthy();
      expect(guide.image).toBe(`/exercise-guides/${exercise.guideId}.webp`);
      expect(existsSync(fileURLToPath(new URL(`../public${guide.image}`, import.meta.url)))).toBe(true);
      expect(guide.width).toBeGreaterThan(450); expect(guide.height).toBeGreaterThan(450);
      imagePaths.add(guide.image);
    }
    expect(imagePaths.size).toBe(66);
    expect(getExerciseGuide("__proto__")).toBeNull();
  });
});

describe("safe historical records", () => {
  it("never maps an old position to a new, different exercise", () => {
    const old = { "0:2":{done:true}, "2:0":{sets:{1:{weight:25,reps:10}}} };
    const migrated = migrateItems(old,"day1");
    expect(migrated.items["day1:wall-slides"]).toBeUndefined();
    expect(migrated.items["day1:hack-squat"]).toBeUndefined();
    expect(migrated.items["0:2"]).toEqual(old["0:2"]);
    expect(getItemByLegacyKey("day1",0,2).name).toBe("Squat-to-stand");
  });
  it("preserves both values on a historical/current key collision", () => {
    const migrated=migrateItems({"day1:incline-db-press":{sets:{1:{weight:30}}},"2:1":{sets:{1:{weight:20}}}},"day1");
    expect(migrated.items["day1:incline-db-press"].sets[1].weight).toBe(30);
    expect(migrated.items["2:1"].sets[1].weight).toBe(20);
  });
  it("exports old removed exercises and removed days using their original identity", () => {
    const text=formatSessionAsText({date:"2026-09-28",day:"day1",items:{"0:2":{done:true}}},PROGRAM);
    expect(text).toContain("Squat-to-stand ✓");
    expect(text).not.toContain("Wall slides ✓");
    const archived=formatSessionAsText({date:"2026-09-28",day:"day4",items:{"day4:sled-push":{sets:{1:{reps:20,done:true}}}}},PROGRAM);
    expect(archived).toContain("Archived workout — day4"); expect(archived).toContain("20 m");
    expect(archived).not.toContain("Full Body A");
  });
  it("exports a completed cardio session even when its notes are blank", () => {
    expect(formatSessionAsText({date:"2026-10-15",day:"day1",items:{"day1:cardio":{done:true}}},PROGRAM)).toContain("✓ Done");
  });
});

describe("progress and resume navigation", () => {
  it("starts at the first unchecked exercise, then skips completed warm-ups", () => {
    const day=PROGRAM.day1;
    expect(findFirstUnchecked(day)).toEqual({key:"day1:incline-walk",sectionIndex:0});
    const saved=Object.fromEntries(day.sections[0].items.map((exercise)=>[exercise.key,{done:true}]));
    expect(findFirstUnchecked(day,saved)).toEqual({key:"day1:hack-squat",sectionIndex:1});
    saved["day1:hack-squat"]={sets:{1:{done:true},3:{done:true}}};
    expect(findFirstUnchecked(day,saved).key).toBe("day1:hack-squat");
  });
  it("returns null when everything is complete and ignores hidden sets", () => {
    const saved=Object.fromEntries(allItems("day1").map((exercise)=>[exercise.key,exercise.kind==="sets" ? {sets:Object.fromEntries(Array.from({length:exercise.setCount},(_,i)=>[i+1,{done:true}]))} : {done:true}]));
    expect(findFirstUnchecked(PROGRAM.day1,saved)).toBeNull();
    expect(getDayProgress(PROGRAM.day1,saved).percent).toBe(100);
    expect(getItemProgress(item("day1","hack-squat"),{customSetCount:1,sets:{1:{done:true},20:{done:true}}})).toEqual({completed:1,total:1,isComplete:true});
  });
  it("uses bounded counts and reports real progress", () => {
    const exercise=item("day1","hack-squat");
    expect(getSetCount(exercise,{customSetCount:99})).toBe(20);
    expect(getSetCount(exercise,{customSetCount:-2})).toBe(1);
    expect(getSetCount(exercise,{customSetCount:"3"})).toBe(3);
    expect(getDayProgress(PROGRAM.day1,{"day1:incline-walk":{done:true}}).completed).toBe(1);
  });
});

describe("calendar and history correctness", () => {
  it("rejects impossible dates while accepting leap days", () => {
    expect(isDateKey("2026-02-30")).toBe(false); expect(isDateKey("2026-13-01")).toBe(false);
    expect(isDateKey("2024-02-29")).toBe(true); expect(isDateKey("2026-02-29")).toBe(false);
  });
  it("merges local-only work and uses the newer copy for the same session", () => {
    const server=[{date:"2026-10-14",day:"day1",updatedAt:"2026-10-14T10:00:00Z",items:{"day1:dead-bug":{done:true}}}];
    const local={"2026-10-14|day1":{updatedAt:"2026-10-14T11:00:00Z",items:{"day1:dead-bug":{sets:{1:{reps:10}}}}},"2026-10-15|day2":{updatedAt:"2026-10-15T11:00:00Z",items:{"day2:side-plank":{sets:{1:{reps:30}}}}}};
    const history=mergeSessionHistory(server,local);
    expect(history).toHaveLength(2); expect(history[0].day).toBe("day2");
    expect(history[1].items["day1:dead-bug"].sets[1].reps).toBe(10);
  });
  it("does not resurrect a locally cleared session from stale cloud history", () => {
    const server=[{date:"2026-10-14",day:"day1",updatedAt:"2026-10-14T10:00:00Z",items:{"day1:dead-bug":{done:true}}}];
    expect(mergeSessionHistory(server,{"2026-10-14|day1":{updatedAt:"2026-10-14T11:00:00Z",items:{}}})).toEqual([]);
  });
});
