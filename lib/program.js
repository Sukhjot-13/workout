import LEGACY_ITEMS from "./legacy-items.json";

export const PROGRAM_VERSION = 3;

function simple(id, name, prescription, note = "") {
  return { id, guideId: id, kind: "simple", name, prescription, note };
}
function sets(id, name, setCount, target, note, options = {}) {
  const { unit = "reps", track = "weightReps", range, guideId = id, per = "" } = options;
  return { id, guideId, kind: "sets", name, setCount, target, note, unit, track,
    prescription: `${range || setCount} × ${target}${unit === "sec" ? " sec" : ""}${per}` };
}
function cardio(intervals = false) {
  return { id: "cardio", guideId: "bike-elliptical", kind: "result", name: "Cardio",
    prescription: intervals ? "20–25 min steady · or 5 × (1 min moderately hard + 2 min easy)" : "20–25 minutes · steady moderate pace",
    note: intervals ? "Choose steady cardio while rebuilding conditioning. When ready, the bike/elliptical interval option takes 15 minutes total." : "Incline walking, bike or elliptical. Breathe harder while still being able to hold a conversation.",
    label1: "Activity + duration", label2: "Speed, incline or notes" };
}
const hang = (count = 3, range = "2–3") => sets("dead-hang", "Dead Hang", count, "20–45", "Grip, shoulders and posture. Use foot support if needed; keep the hold comfortable.", { unit: "sec", track: "reps", range });
const hipStretch = () => simple("hip-flexor-stretch", "Hip-Flexor Stretch", "30–45 sec/side", "Hip flexors");
const hamstringStretch = () => simple("hamstring-stretch", "Hamstring Stretch", "30–45 sec/side", "Hamstrings");

export const PROGRAM = {
  day1: {
    title: "Day 1 — Full Body A", subtitle: "Squat, upper chest, back width/thickness, arms, calves, core",
    sections: [
      { title: "Warm-up", hint: "5-minute walk, then easy mobility", items: [
        simple("incline-walk", "Incline treadmill walk", "5 min", "Warm-up/cardio"),
        simple("ankle-rocks", "Ankle rocks", "10/side", "Ankle mobility"),
        simple("wall-slides", "Wall slides", "10", "Shoulders/posture"),
        simple("band-pull-apart", "Band pull-aparts", "15", "Rear shoulder/scapula"),
        simple("bodyweight-squat", "Bodyweight squats", "10", "Lower-body prep"),
      ] },
      { title: "Main strength", hint: "Rest 2–3 minutes between working sets", items: [
        sets("hack-squat", "Hack Squat (or Goblet Squat)", 3, "6–10", "Quads, glutes, adductors"),
        sets("incline-db-press", "Incline DB Press", 3, "8–12", "Upper chest, triceps, front delt"),
        sets("supported-row", "Chest-Supported Row", 3, "8–12", "Mid-back, traps, rhomboids"),
        sets("rdl", "Romanian Deadlift", 3, "8–10", "Hamstrings, glutes, erectors"),
        sets("neutral-pulldown", "Neutral-Grip Lat Pulldown", 3, "8–12", "Lats/back width", { range: "2–3" }),
      ] },
      { title: "Shoulders + arms", items: [
        sets("cable-lateral", "Cable Lateral Raise", 2, "12–20", "Side delts"),
        sets("rope-pushdown", "Rope Triceps Pushdown", 3, "10–15", "Triceps lateral/medial heads"),
        sets("incline-curl", "Incline DB Curl", 2, "10–15", "Biceps"),
      ] },
      { title: "Calves + core", items: [
        sets("standing-calf", "Standing Calf Raise", 3, "10–15", "Gastrocnemius"),
        sets("tibialis", "Tibialis Raise", 2, "15–25", "Front of shin", { track: "reps" }),
        sets("pallof", "Pallof Press", 2, "10–12/side", "Anti-rotation core"),
        sets("dead-bug", "Dead Bug", 2, "8–10/side", "Deep core", { track: "reps" }),
        sets("farmer", "Farmer Carry", 2, "30–45", "Grip, traps, core, posture", { unit: "sec" }),
      ] },
      { title: "Cardio", items: [cardio()] },
      { title: "Finish", items: [hang(), simple("doorway-stretch", "Doorway Chest Stretch", "30 sec/side", "Chest"), hipStretch(), simple("calf-stretch", "Calf Stretch", "30 sec/side", "Calves")] },
    ],
  },
  day2: {
    title: "Day 2 — Full Body B", subtitle: "Unilateral athletic strength, glutes, shoulders, hamstrings, posture",
    sections: [
      { title: "Warm-up", hint: "5-minute bike or elliptical, then mobility", items: [
        simple("bike-elliptical", "Bike / elliptical", "5 min", "Warm-up"),
        simple("hip-90-90", "90/90 hip rotations", "6/side", "Hip mobility"),
        simple("elephant-walk", "Elephant walks", "8/side", "Hamstrings"),
        simple("band-external-rotation", "Band external rotation", "12–15", "Rotator cuff"),
        simple("glute-bridge", "Glute bridges", "10", "Glute activation"),
      ] },
      { title: "Main strength", hint: "Rest 2–3 minutes between working sets", items: [
        sets("bulgarian", "Bulgarian Split Squat", 3, "8–10/leg", "Quads, glutes, balance"),
        sets("hip-thrust", "Hip Thrust", 3, "8–12", "Glute max"),
        sets("landmine-press", "Landmine Press (or DB Shoulder Press)", 3, "8–12", "Shoulders, triceps"),
        sets("pulldown-assisted", "Lat Pulldown / Assisted Pull-Up", 3, "8–12", "Lats"),
        sets("seated-row", "Seated Cable Row", 3, "10–15", "Rhomboids, middle traps", { range: "2–3" }),
        sets("leg-curl", "Leg Curl", 3, "10–15", "Hamstrings"),
      ] },
      { title: "Hips + shoulder control", items: [
        sets("hip-abduction", "Hip Abduction Machine", 2, "12–20", "Glute med/min"),
        sets("hip-adduction", "Hip Adduction Machine", 2, "12–20", "Inner thighs"),
        sets("face-pull", "Face Pull", 2, "12–20", "Rear delts, cuff, posture"),
        sets("external-rotation", "Cable/Band External Rotation", 2, "15–20/arm", "Rotator cuff"),
        sets("internal-rotation", "Cable/Band Internal Rotation", 2, "15–20/arm", "Subscapularis/cuff", { range: "1–2" }),
      ] },
      { title: "Calves + core", items: [
        sets("seated-calf", "Seated Calf Raise", 3, "12–20", "Soleus"),
        sets("psoas", "Seated Psoas March", 2, "10–15/leg", "Hip flexors", { track: "reps" }),
        sets("side-plank", "Side Plank", 2, "30–45", "Obliques/lateral core · complete both sides", { unit: "sec", track: "reps", per: "/side" }),
        sets("bird-dog", "Bird Dog", 2, "8–10/side", "Spinal/core stability", { track: "reps" }),
      ] },
      { title: "Cardio", items: [cardio()] },
      { title: "Finish", items: [hang(2, "2"), simple("thoracic-extension", "Thoracic Extension", "8–10 reps", "Upper-back mobility"), hamstringStretch(), hipStretch()] },
    ],
  },
  day3: {
    title: "Day 3 — Full Body C", subtitle: "Complete physique, chest, back detail, arms, grip, neck/feet",
    sections: [
      { title: "Warm-up", hint: "5-minute treadmill or rower, then movement prep", items: [
        simple("treadmill-rower", "Treadmill / rower", "5 min", "Warm-up"),
        simple("reverse-lunge", "Reverse lunge", "6/leg", "Lower-body prep"),
        simple("wall-slides", "Wall slides", "10", "Posture"),
        simple("push-up-plus", "Push-up Plus", "10", "Serratus"),
        simple("light-face-pull", "Light band face pull", "15", "Scapular prep"),
      ] },
      { title: "Main strength", hint: "Rest 2–3 minutes between working sets", items: [
        sets("leg-press", "Leg Press", 3, "10–12", "Quads, glutes"),
        sets("flat-db-press", "Flat DB Press", 3, "8–12", "Mid/general chest"),
        sets("one-arm-cable-row", "One-Arm Cable Row", 3, "8–12/side", "Lats, rhomboids, unilateral control"),
        sets("back-extension", "Back Extension", 2, "10–15", "Erectors, glutes"),
      ] },
      { title: "Chest + back detail", items: [
        sets("high-low-fly", "High-to-Low Cable Fly", 2, "12–15", "Lower/sternal chest"),
        sets("reverse-cable-fly", "Reverse Cable Fly", 2, "12–20", "Rear delts"),
        sets("y-raise", "Cable/Prone Y-Raise", 2, "10–15", "Lower traps"),
        sets("db-shrug", "DB Shrug", 2, "10–15", "Upper traps"),
      ] },
      { title: "Arms + grip", items: [
        sets("hammer-curl", "Hammer Curl", 2, "10–15", "Brachialis, brachioradialis"),
        sets("overhead-triceps", "Overhead Cable Triceps Extension", 3, "10–15", "Triceps long head"),
        sets("wrist-curl", "Wrist Curl", 2, "15–20", "Forearm flexors"),
        sets("pronation", "DB Pronation/Supination", 2, "12–15 each", "Forearm rotation · both directions", { range: "1–2" }),
      ] },
      { title: "Core + carries", items: [
        sets("knee-raise", "Hanging Knee Raise", 3, "8–15", "Abs/hip control", { track: "reps" }),
        sets("suitcase", "Suitcase Carry", 2, "30–45", "Obliques, grip, posture · complete both sides", { unit: "sec", per: "/side" }),
      ] },
      { title: "Small resilience block", hint: "About 5 minutes · light, controlled effort", items: [
        sets("neck-isometrics", "Neck Isometrics", 2, "10–20", "Front, back, left, right and gentle rotation · each direction", { unit: "sec", track: "reps", range: "1–2", per: " each direction" }),
        sets("ankle-inversion-eversion", "Band Ankle Inversion + Eversion", 2, "15–20 each", "Both ankles, both directions", { track: "reps", range: "1–2" }),
        sets("short-foot", "Short-Foot / Arch Hold", 2, "20–30", "Foot/arch control · each foot", { unit: "sec", track: "reps", per: "/foot" }),
      ] },
      { title: "Cardio", hint: "Steady now; intervals after conditioning returns", items: [cardio(true)] },
      { title: "Finish", items: [hang(), simple("child-side-reach", "Child’s Pose + Side Reach", "30 sec/side", "Lats and trunk"), simple("doorway-stretch", "Pec Stretch", "30 sec/side", "Chest"), hamstringStretch(), hipStretch()] },
    ],
  },
};

const ALIASES = {
  day1: { "brisk-treadmill-walk": "incline-walk", "bodyweight-squats": "bodyweight-squat", "b-incline-dumbbell-press": "incline-db-press", "c-chest-supported-row": "supported-row", "d-romanian-deadlift": "rdl", "e-neutral-grip-lat-pulldown": "neutral-pulldown", "rope-triceps-pushdown": "rope-pushdown", "incline-dumbbell-curl": "incline-curl", "standing-calf-raise": "standing-calf", "tibialis-raise": "tibialis", "pallof-press": "pallof", "farmer-carry": "farmer", "doorway-pec-stretch": "doorway-stretch", "kneeling-hip-flexor-stretch": "hip-flexor-stretch" },
  day2: { "90-90-hip-rotations": "hip-90-90", "elephant-walks": "elephant-walk", "glute-bridges": "glute-bridge", "a-bulgarian-split-squat": "bulgarian", "b-hip-thrust": "hip-thrust", "d-lat-pulldown-assisted-pull-up": "pulldown-assisted", "e-seated-cable-row": "seated-row", "f-leg-curl": "leg-curl", "cable-external-rotation": "external-rotation", "cable-internal-rotation": "internal-rotation", "seated-calf-raise": "seated-calf" },
  day3: { "rowing-machine-or-treadmill": "treadmill-rower", "reverse-lunges": "reverse-lunge", "light-face-pulls": "light-face-pull", "b-flat-dumbbell-press": "flat-db-press", "c-one-arm-cable-row": "one-arm-cable-row", "d-back-extension": "back-extension", "e-high-to-low-cable-fly": "high-low-fly", "reverse-cable-fly-rear-delt-fly": "reverse-cable-fly", "cable-prone-y-raise": "y-raise", "dumbbell-shrug": "db-shrug", "overhead-cable-triceps-extension": "overhead-triceps", "hanging-knee-raise": "knee-raise", "suitcase-carry": "suitcase", "short-foot-arch-doming-exercise": "short-foot", "child-s-pose-with-side-reach": "child-side-reach", "pec-stretch": "doorway-stretch" },
};

function canonicalKey(key, dayId) {
  const slug = key.slice(dayId.length + 1);
  return `${dayId}:${ALIASES[dayId]?.[slug] || slug}`;
}
function decorateProgram() {
  for (const [dayId, day] of Object.entries(PROGRAM)) {
    day.sections.forEach((section) => section.items.forEach((item) => {
      item.key = `${dayId}:${item.id}`;
      item.legacyKey = Object.entries(LEGACY_ITEMS[dayId] || {}).find(([, old]) => canonicalKey(old.key, dayId) === item.key)?.[0];
    }));
  }
}
decorateProgram();

export function hasLoggedValue(value) {
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  return typeof value === "string" && value.trim() !== "";
}
export function hasSessionData(items) {
  if (!items || typeof items !== "object") return false;
  return Object.values(items).some((item) => item && typeof item === "object" &&
    (item.done || hasLoggedValue(item.value1) || hasLoggedValue(item.value2) ||
      Object.values(item.sets || {}).some((set) => set && (set.done || hasLoggedValue(set.weight) || hasLoggedValue(set.reps)))));
}
export function getProgramDay(dayId) { return PROGRAM[dayId] || null; }
export function getItemByLegacyKey(dayId, sIdx, iIdx) {
  const old = LEGACY_ITEMS[dayId]?.[`${sIdx}:${iIdx}`];
  if (!old) return null;
  const key = canonicalKey(old.key, dayId);
  return PROGRAM[dayId]?.sections.flatMap((section) => section.items).find((item) => item.key === key) || old;
}
export function getArchivedItem(key, dayId) {
  return LEGACY_ITEMS[dayId]?.[key] || Object.values(LEGACY_ITEMS[dayId] || {}).find((item) => item.key === key) || { name: key, unit: "reps" };
}
export function migrateItems(rawItems, dayId) {
  if (!rawItems || typeof rawItems !== "object" || Array.isArray(rawItems)) return { items: {}, rekeyed: false, unmapped: [] };
  const known = new Set(PROGRAM[dayId]?.sections.flatMap((section) => section.items.map((item) => item.key)) || []);
  const items = {};
  let rekeyed = false;
  for (const [key, value] of Object.entries(rawItems)) if (known.has(key)) items[key] = value;
  for (const [key, value] of Object.entries(rawItems)) {
    if (known.has(key)) continue;
    const oldKey = LEGACY_ITEMS[dayId]?.[key]?.key || key;
    const mapped = canonicalKey(oldKey, dayId);
    if (known.has(mapped) && !Object.hasOwn(items, mapped)) { items[mapped] = value; rekeyed = true; }
    else items[key] = value;
  }
  return { items, rekeyed, unmapped: Object.keys(items).filter((key) => !known.has(key)) };
}
