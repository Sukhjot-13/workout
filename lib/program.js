
function simple(name, prescription, note = "") {
  return { kind: "simple", name, prescription, note };
}
function info(name, note = "") {
  return { kind: "info", name, prescription: "", note };
}
function sets(name, prescription, note, setCount, target, track) {
  return {
    kind: "sets",
    name,
    prescription,
    note,
    setCount,
    target,
    track,
  };
}

function result(name, prescription, note, label1, label2) {
  return { kind: "result", name, prescription, note, label1, label2 };
}

export function hasSessionData(items) {
  if (!items || typeof items !== "object") return false;
  for (const key of Object.keys(items)) {
    const item = items[key];
    if (!item || typeof item !== "object") continue;

    if (item.done) return true;
    if (typeof item.value1 === "string" && item.value1.trim() !== "") return true;
    if (typeof item.value2 === "string" && item.value2.trim() !== "") return true;

    if (item.sets && typeof item.sets === "object") {
      for (const setKey of Object.keys(item.sets)) {
        const s = item.sets[setKey];
        if (!s || typeof s !== "object") continue;
        if (s.done) return true;
        if (s.weight !== undefined && s.weight !== null && String(s.weight).trim() !== "") return true;
        if (s.reps !== undefined && s.reps !== null && String(s.reps).trim() !== "") return true;
      }
    }
  }
  return false;
}

export const PROGRAM = {
        day1: {
          title: "Day 1 — Full Body A",
          subtitle: "Squat + Upper Chest + Back + Foundation",
          sections: [
            {
              title: "1. Warm-up — 8–10 minutes",
              hint: "Brisk walk 5 min, then mobility. (No jumping jacks)",
              items: [
                simple("Brisk treadmill walk", "5 minutes"),
                simple("Ankle rocks", "10/side"),
                simple("Squat-to-stand", "8"),
                simple("Cat-cow", "8"),
                simple("Wall slides", "10"),
                simple("Push-up plus", "10"),
                simple("Bodyweight squats", "10"),
              ],
            },
            {
              title: "2. Athletic activation",
              hint: "Starting Week 3",
              items: [
                sets(
                  "Medicine-ball chest throw",
                  "3 × 5",
                  "Explosive throws. Don’t turn this into cardio.",
                  3,
                  "5",
                  "weightReps",
                ),
              ],
            },
            {
              title: "3. Main strength work",
              items: [
                sets(
                  "A. Goblet Squat / Hack Squat",
                  "3 × 8–12",
                  "Targets: quads, glutes, adductors, core. Eventually you can progress to another squat variation if desired.",
                  3,
                  "8–12",
                  "weightReps",
                ),
                sets(
                  "B. Incline Dumbbell Press",
                  "3 × 8–12",
                  "Targets: upper chest, general chest, front delts, triceps.",
                  3,
                  "8–12",
                  "weightReps",
                ),
                sets(
                  "C. Chest-Supported Row",
                  "3 × 8–12",
                  "Targets: rhomboids, middle traps, lats, rear delts.",
                  3,
                  "8–12",
                  "weightReps",
                ),
                sets(
                  "D. Romanian Deadlift",
                  "3 × 8–10",
                  "Targets: hamstrings, glutes, spinal erectors.",
                  3,
                  "8–10",
                  "weightReps",
                ),
                sets(
                  "E. Neutral-Grip Lat Pulldown",
                  "2–3 × 8–12",
                  "Targets: lats, teres major, biceps.",
                  3,
                  "8–12",
                  "weightReps",
                ),
              ],
            },
            {
              title: "4. Shoulders + arms",
              items: [
                sets(
                  "Cable or DB Lateral Raise",
                  "2 × 12–20",
                  "Side delts.",
                  2,
                  "12–20",
                  "weightReps",
                ),
                sets(
                  "Rope Triceps Pushdown",
                  "2 × 10–15",
                  "Triceps lateral/medial emphasis.",
                  2,
                  "10–15",
                  "weightReps",
                ),
                sets(
                  "Incline Dumbbell Curl",
                  "2 × 10–15",
                  "Biceps.",
                  2,
                  "10–15",
                  "weightReps",
                ),
              ],
            },
            {
              title: "5. Forearms",
              items: [
                sets(
                  "DB Wrist Extension",
                  "2 × 15–20",
                  "Forearm extensors.",
                  2,
                  "15–20",
                  "weightReps",
                ),
                sets(
                  "DB Pronation/Supination",
                  "1–2 × 12–15 each direction",
                  "Very light weight. This trains rotational forearm strength that wrist curls don’t cover.",
                  2,
                  "12–15",
                  "weightReps",
                ),
              ],
            },
            {
              title: "6. Lower legs",
              items: [
                sets(
                  "Standing Calf Raise",
                  "3 × 10–15",
                  "Gastrocnemius.",
                  3,
                  "10–15",
                  "weightReps",
                ),
                sets(
                  "Tibialis Raise",
                  "2 × 15–25",
                  "Tibialis anterior/front of shin.",
                  2,
                  "15–25",
                  "weightReps",
                ),
              ],
            },
            {
              title: "7. Core",
              items: [
                sets(
                  "Pallof Press",
                  "2 × 10–12/side",
                  "Anti-rotation.",
                  2,
                  "10–12/side",
                  "weightReps",
                ),
                sets(
                  "Dead Bug",
                  "2 × 6–10/side",
                  "Deep core + anti-extension.",
                  2,
                  "6–10/side",
                  "reps",
                ),
              ],
            },
            {
              title: "8. Grip + posture",
              items: [
                sets(
                  "Farmer Carry",
                  "2 × 30–45 seconds",
                  "Excellent combination of grip, forearms, traps, core, shoulder stability and posture. Walk upright.",
                  2,
                  "30–45 sec",
                  "weightReps",
                ),
              ],
            },
            {
              title: "9. Cardio",
              items: [
                result(
                  "Cardio",
                  "20–25 minutes",
                  "Choose: incline treadmill walking, elliptical, stationary bike. Intensity should usually be moderate enough that you can still speak in short sentences. You don’t need to destroy yourself after lifting.",
                  "Actual cardio",
                  "Notes",
                ),
              ],
            },
            {
              title: "10. Posture + decompression",
              items: [
                sets(
                  "Dead Hang",
                  "2–3 × 20–45 sec",
                  "Do not hang painfully or force shoulder range.",
                  3,
                  "20–45 sec",
                  "reps",
                ),
                sets(
                  "Doorway Pec Stretch",
                  "2 × 30 sec",
                  "",
                  2,
                  "30 sec",
                  "reps",
                ),
                sets(
                  "Kneeling Hip-Flexor Stretch",
                  "2 × 30–45 sec/side",
                  "",
                  2,
                  "30–45 sec/side",
                  "reps",
                ),
                sets(
                  "Lat Stretch",
                  "1–2 × 30 sec/side",
                  "",
                  2,
                  "30 sec/side",
                  "reps",
                ),
              ],
            },
          ],
        },
        day2: {
          title: "Day 2 — Full Body B",
          subtitle:
            "Posterior Chain + Shoulders + Unilateral Strength + Posture",
          sections: [
            {
              title: "1. Warm-up",
              hint: "Then:",
              items: [
                simple("Bike/elliptical", "5 minutes"),
                simple("90/90 hip rotations", "6/side"),
                simple("Elephant walks", "10/side"),
                simple("Ankle rocks", "10/side"),
                simple("Wall slides", "10"),
                simple("Glute bridges", "10"),
                simple("Scapular pulldowns", "10"),
              ],
            },
            {
              title: "2. Athletic activation",
              hint: "Starting Week 3",
              items: [
                sets(
                  "Medicine-Ball Rotational Throw",
                  "2–3 × 5/side",
                  "Develops rotational power.",
                  3,
                  "5/side",
                  "weightReps",
                ),
              ],
            },
            {
              title: "3. Main training",
              items: [
                sets(
                  "A. Bulgarian Split Squat",
                  "3 × 8–10/leg",
                  "Targets: quads, glute max, glute medius, adductors, balance, unilateral stability. If you dislike these later, replace them with: reverse lunges, step-ups, supported split squats, single-leg press. We keep the function, not necessarily the exercise.",
                  3,
                  "8–10/leg",
                  "weightReps",
                ),
                sets(
                  "B. Hip Thrust",
                  "3 × 8–12",
                  "Glute max.",
                  3,
                  "8–12",
                  "weightReps",
                ),
                sets(
                  "C. Dumbbell Shoulder Press OR Landmine Press",
                  "3 × 8–12",
                  "Targets: anterior delts, lateral delts, triceps. Landmine press is perfectly acceptable if it feels better.",
                  3,
                  "8–12",
                  "weightReps",
                ),
                sets(
                  "D. Lat Pulldown / Assisted Pull-Up",
                  "3 × 8–12",
                  "Vertical pulling.",
                  3,
                  "8–12",
                  "weightReps",
                ),
                sets(
                  "E. Seated Cable Row",
                  "2–3 × 10–15",
                  "Mid-back/postural muscles.",
                  3,
                  "10–15",
                  "weightReps",
                ),
                sets(
                  "F. Leg Curl",
                  "2–3 × 10–15",
                  "Direct hamstring knee-flexion work. RDL + leg curls means we’re training both major hamstring functions.",
                  3,
                  "10–15",
                  "weightReps",
                ),
              ],
            },
            {
              title: "4. Inner + outer hips",
              items: [
                sets(
                  "Hip Abduction",
                  "2 × 12–20",
                  "Glute medius/minimus.",
                  2,
                  "12–20",
                  "weightReps",
                ),
                sets(
                  "Hip Adduction",
                  "2 × 12–20",
                  "Adductors/inner thigh.",
                  2,
                  "12–20",
                  "weightReps",
                ),
              ],
            },
            {
              title: "5. Rotator cuff + scapular health",
              items: [
                sets(
                  "Face Pull",
                  "2 × 12–20",
                  "Rear delts + scapular control + cuff.",
                  2,
                  "12–20",
                  "weightReps",
                ),
                sets(
                  "Cable External Rotation",
                  "2 × 12–20/arm",
                  "Light.",
                  2,
                  "12–20/arm",
                  "weightReps",
                ),
                sets(
                  "Cable Internal Rotation",
                  "1–2 × 15–20/arm",
                  "Also light. We’re training shoulder health here, not chasing heavy numbers.",
                  2,
                  "15–20/arm",
                  "weightReps",
                ),
              ],
            },
            {
              title: "6. Calves",
              items: [
                sets(
                  "Seated Calf Raise",
                  "3 × 12–20",
                  "Primarily soleus. Day 1 standing calves + Day 2 seated calves gives us both major calf functions.",
                  3,
                  "12–20",
                  "weightReps",
                ),
              ],
            },
            {
              title: "7. Direct hip flexors",
              items: [
                sets(
                  "Seated Psoas March OR Standing Cable Knee Drive",
                  "2 × 10–15/leg",
                  "Controlled movement. No swinging.",
                  2,
                  "10–15/leg",
                  "weightReps",
                ),
              ],
            },
            {
              title: "8. Core",
              items: [
                sets(
                  "Side Plank",
                  "2 × 30–45 sec/side",
                  "Obliques + lateral stability.",
                  2,
                  "30–45 sec/side",
                  "reps",
                ),
                sets(
                  "Bird Dog",
                  "2 × 8–10/side",
                  "Core + spinal stability.",
                  2,
                  "8–10/side",
                  "reps",
                ),
              ],
            },
            {
              title: "9. Cardio",
              items: [
                result(
                  "Cardio",
                  "20–30 minutes",
                  "Easy/moderate: bike, incline walking, elliptical.",
                  "Actual cardio",
                  "Notes",
                ),
              ],
            },
            {
              title: "10. Mobility/posture",
              items: [
                sets(
                  "Dead Hang",
                  "2–3 × 20–45 sec",
                  "",
                  3,
                  "20–45 sec",
                  "reps",
                ),
                sets("Thoracic Extension", "1–2 × 8–10", "", 2, "8–10", "reps"),
                sets(
                  "Hamstring Stretch",
                  "2 × 30–45 sec/side",
                  "",
                  2,
                  "30–45 sec/side",
                  "reps",
                ),
                sets(
                  "Hip-Flexor Stretch",
                  "2 × 30–45 sec/side",
                  "",
                  2,
                  "30–45 sec/side",
                  "reps",
                ),
                sets(
                  "Calf Stretch",
                  "1–2 × 30 sec/side",
                  "",
                  2,
                  "30 sec/side",
                  "reps",
                ),
              ],
            },
          ],
        },
        day3: {
          title: "Day 3 — Full Body C",
          subtitle: "Complete Physique + Athletic Strength + Neck + Feet",
          sections: [
            {
              title: "1. Warm-up",
              hint: "Then:",
              items: [
                simple("Rowing machine or treadmill", "5 minutes"),
                simple("Ankle rocks", "10/side"),
                simple("World’s Greatest Stretch", "5/side"),
                simple("Push-Up Plus", "10"),
                simple("Wall slides", "10"),
                simple("Reverse lunges", "6/leg"),
                simple("Light face pulls", "12"),
              ],
            },
            {
              title: "2. Athletic power",
              hint: "Choose ONE",
              items: [
                sets(
                  "Sled Push",
                  "3–4 × 15–25 m",
                  "My favorite option.",
                  4,
                  "15–25 m",
                  "weightReps",
                ),
                sets(
                  "Kettlebell Swing",
                  "3 × 8–10",
                  "Explosive hip hinge alternative.",
                  3,
                  "8–10",
                  "weightReps",
                ),
                sets(
                  "Medicine-Ball Slam",
                  "3 × 8–10",
                  "You don’t need jumping exercises to become athletic.",
                  3,
                  "8–10",
                  "weightReps",
                ),
              ],
            },
            {
              title: "3. Main strength work",
              items: [
                sets(
                  "A. Leg Press / Hack Squat",
                  "3 × 10–12",
                  "Quads + glutes + adductors.",
                  3,
                  "10–12",
                  "weightReps",
                ),
                sets(
                  "B. Flat Dumbbell Press",
                  "3 × 8–12",
                  "General/mid chest.",
                  3,
                  "8–12",
                  "weightReps",
                ),
                sets(
                  "C. One-Arm Cable Row",
                  "3 × 8–12/side",
                  "Lats + rhomboids + traps + unilateral control.",
                  3,
                  "8–12/side",
                  "weightReps",
                ),
                sets(
                  "D. Back Extension",
                  "2 × 10–15",
                  "Targets: spinal erectors, glutes, posterior chain. Don’t excessively arch at the top.",
                  2,
                  "10–15",
                  "weightReps",
                ),
                sets(
                  "E. High-to-Low Cable Fly",
                  "2 × 12–15",
                  "Completes chest work through another angle.",
                  2,
                  "12–15",
                  "weightReps",
                ),
              ],
            },
            {
              title: "4. Complete shoulder/back detail",
              items: [
                sets(
                  "Reverse Cable Fly / Rear-Delt Fly",
                  "2 × 12–20",
                  "Rear delts.",
                  2,
                  "12–20",
                  "weightReps",
                ),
                sets(
                  "Cable/Prone Y-Raise",
                  "2 × 10–15",
                  "Lower traps + scapular control.",
                  2,
                  "10–15",
                  "weightReps",
                ),
                sets(
                  "Dumbbell Shrug",
                  "2 × 10–15",
                  "Upper traps. Pause briefly at the top.",
                  2,
                  "10–15",
                  "weightReps",
                ),
              ],
            },
            {
              title: "5. Arms",
              items: [
                sets(
                  "Hammer Curl",
                  "2 × 10–15",
                  "Targets: brachialis, brachioradialis, biceps.",
                  2,
                  "10–15",
                  "weightReps",
                ),
                sets(
                  "Overhead Cable Triceps Extension",
                  "2 × 10–15",
                  "Emphasizes triceps long head.",
                  2,
                  "10–15",
                  "weightReps",
                ),
              ],
            },
            {
              title: "6. Forearms",
              items: [
                sets(
                  "Wrist Curl",
                  "2 × 15–20",
                  "Forearm flexors. Your weekly forearm coverage is now: flexion, extension, pronation, supination, brachioradialis, grip.",
                  2,
                  "15–20",
                  "weightReps",
                ),
              ],
            },
            {
              title: "7. Neck",
              hint: "Start very gently. Use your own hand for resistance. Do not start with heavy weighted neck exercises.",
              items: [
                sets(
                  "Neck Isometrics — Front",
                  "2 × 10–20 sec",
                  "",
                  2,
                  "10–20 sec",
                  "reps",
                ),
                sets(
                  "Neck Isometrics — Back",
                  "2 × 10–20 sec",
                  "",
                  2,
                  "10–20 sec",
                  "reps",
                ),
                sets(
                  "Neck Isometrics — Left lateral",
                  "2 × 10–20 sec",
                  "",
                  2,
                  "10–20 sec",
                  "reps",
                ),
                sets(
                  "Neck Isometrics — Right lateral",
                  "2 × 10–20 sec",
                  "",
                  2,
                  "10–20 sec",
                  "reps",
                ),
                sets(
                  "Rotation isometric",
                  "1–2 × 10–20 sec/side",
                  "",
                  2,
                  "10–20 sec/side",
                  "reps",
                ),
              ],
            },
            {
              title: "8. Ankles",
              items: [
                sets(
                  "Band Ankle Eversion",
                  "1–2 × 15–20/side",
                  "",
                  2,
                  "15–20/side",
                  "reps",
                ),
                sets(
                  "Band Ankle Inversion",
                  "1–2 × 15–20/side",
                  "These cover smaller ankle stabilizers that calf/tib raises don’t fully address.",
                  2,
                  "15–20/side",
                  "reps",
                ),
              ],
            },
            {
              title: "9. Feet",
              items: [
                sets(
                  "Short-Foot / Arch-Doming Exercise",
                  "2 × 20–30 sec/foot",
                  "",
                  2,
                  "20–30 sec/foot",
                  "reps",
                ),
                sets(
                  "Optional: Toe yoga",
                  "1 × 10",
                  "Big toe down/others up, then reverse.",
                  1,
                  "10",
                  "reps",
                ),
              ],
            },
            {
              title: "10. Core",
              items: [
                sets(
                  "Hanging Knee Raise",
                  "2–3 × 8–15",
                  "Rectus abs + hip control.",
                  3,
                  "8–15",
                  "reps",
                ),
                sets(
                  "Suitcase Carry",
                  "2 × 30–45 sec/side",
                  "Targets: obliques, QL, anti-lateral flexion, grip, posture.",
                  2,
                  "30–45 sec/side",
                  "weightReps",
                ),
              ],
            },
            {
              title: "11. Cardio",
              items: [
                result(
                  "Cardio",
                  "20–25 minutes moderate",
                  "Bike, elliptical or incline walking.",
                  "Actual cardio",
                  "Notes",
                ),
              ],
            },
            {
              title: "12. Mobility + decompression",
              items: [
                sets(
                  "Dead Hang",
                  "2–3 × 20–45 sec",
                  "",
                  3,
                  "20–45 sec",
                  "reps",
                ),
                sets(
                  "Child’s Pose with side reach",
                  "30 sec/side",
                  "",
                  1,
                  "30 sec/side",
                  "reps",
                ),
                sets(
                  "Pec stretch",
                  "30 sec/side",
                  "",
                  1,
                  "30 sec/side",
                  "reps",
                ),
                sets(
                  "Hip-flexor stretch",
                  "30–45 sec/side",
                  "",
                  1,
                  "30–45 sec/side",
                  "reps",
                ),
                sets(
                  "Hamstring stretch",
                  "30–45 sec/side",
                  "",
                  1,
                  "30–45 sec/side",
                  "reps",
                ),
              ],
            },
          ],
        },
        day4: {
          title: "Optional Day 4",
          subtitle: "Athleticism + Heart + Conditioning",
          sections: [
            {
              title: "Warm-up",
              items: [
                simple("Walking/bike/elliptical", "5–8 minutes"),
                simple("Dynamic hip, ankle and shoulder mobility", ""),
              ],
            },
            {
              title: "Athletic circuit",
              hint: "Do 2–3 rounds initially (later 3–4). Rest sufficiently to maintain movement quality—it’s conditioning, not a race.",
              items: [
                sets("Sled Push", "15–25 m", "", 4, "15–25 m", "weightReps"),
                sets("Farmer Carry", "30–40 m", "", 4, "30–40 m", "weightReps"),
                sets("Reverse Lunge", "8/leg", "", 4, "8/leg", "weightReps"),
                sets("Push-Up", "8–15", "", 4, "8–15", "reps"),
                sets(
                  "Chest-Supported/Cable Row",
                  "10–15",
                  "",
                  4,
                  "10–15",
                  "weightReps",
                ),
                sets(
                  "Lateral Shuffle",
                  "15–20 sec each direction",
                  "",
                  4,
                  "15–20 sec each direction",
                  "reps",
                ),
              ],
            },
            {
              title: "Cardio — Preferred option most weeks",
              items: [
                result(
                  "Easy/moderate cardio",
                  "30–45 minutes",
                  "This is great for your cardiovascular base.",
                  "Actual cardio",
                  "Notes",
                ),
              ],
            },
            {
              title: "Cardio — Later alternative",
              items: [
                result(
                  "Bike/rower intervals",
                  "30–60 sec faster, then 90–120 sec easy. Repeat 5–8 rounds.",
                  "Once your aerobic fitness has returned. Hard but controlled. Not an all-out sprint.",
                  "Actual intervals",
                  "Notes",
                ),
              ],
            },
            {
              title: "Longer mobility session",
              hint: "Spend approximately 10–15 minutes on:",
              items: [
                simple("Ankles", ""),
                simple("Calves", ""),
                simple("Quads", ""),
                simple("Hamstrings", ""),
                simple("Adductors", ""),
                simple("Glutes", ""),
                simple("Hip flexors", ""),
                simple("Thoracic spine", ""),
                simple("Lats", ""),
                simple("Pecs", ""),
                simple("Shoulders", ""),
                simple("Wrists", ""),
                sets(
                  "Dead Hang",
                  "2–3 comfortable sets",
                  "Finish with:",
                  3,
                  "comfortable",
                  "reps",
                ),
              ],
            },
          ],
        },
      };
