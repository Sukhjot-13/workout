# Exercise illustrations

Created 2026-10-15 with the built-in imagegen tool. Eleven generated atlases contain 66 exercise tiles. The owner requested individual images after approving the generated sheets. All 66 tiles are now trimmed into separate WebP files in `public/exercise-guides/`, each loaded only when its Form guide opens. Approved source sheets are preserved in `docs/exercise-atlases/`; `docs/exercise-image-sources.json` records each source and exact crop rectangle. The source PNGs also remain in Codex generated_images. Trimming used sharp to preserve the approved artwork without generating replacements.

## Shared prompt

```
Use case: scientific-educational.
Asset type: six-tile exercise form reference atlas for an app. Create one landscape 3:2 image, preferably 3072 by 2048.
Composition: EXACTLY 3 equal-width columns and 2 equal-height rows, six square tiles, occupying the full canvas. No outer margin, no title outside tiles, no gutters. Thin subtle dividing lines exactly at one-third and two-thirds width and halfway height. Each tile has its own exercise name at the very top INSIDE the tile and two clear full-body start/finish poses connected by a small mint arrow. All figures and labels stay well inside their own tile with 6% internal padding. Every tile must stand alone when cropped by the app.
Style: polished clean fitness-instruction illustration, anatomically plausible adult with athletic but realistic build, navy shorts and teal shirt, pale warm ivory background, dark navy equipment and captions, mint arrows. Precise equipment and joint positioning, whole person visible, no decorative gym background, no branding or watermarks. One person per pose, correct limbs, consistent style across all tiles. Keep text to exercise names and tiny START / FINISH or HOLD labels; the app provides the longer text cues. Do not add medical claims.
The six tiles in reading order (top left, top middle, top right, bottom left, bottom middle, bottom right) MUST depict these DIFFERENT exercises:
```

## Individual atlas prompts

### `docs/exercise-atlases/warm-up.webp`

1. Incline treadmill walk — upright torso, easy walking stride, light incline; no hanging on rails.
2. Bike / elliptical — two small demonstrations of upright cycling and elliptical pedaling, shoulders relaxed.
3. Ankle rocks — half-kneeling, heel planted, knee gently moves over toes.
4. Wall slides — back to wall, ribs down, arms slide overhead without arching.
5. Band pull-aparts — straight arms at chest level, pull a resistance band apart.
6. Bodyweight squats — feet planted, knees track toes, sit between hips and stand.

### `docs/exercise-atlases/mobility.webp`

1. 90/90 hip rotations — seated with both knees at right angles, rotate knees side to side with control.
2. Elephant walks — bent forward with hands braced on bench, alternately bend one knee and gently straighten the other.
3. Band external rotation — standing with elbow tucked against ribs, rotate forearm outward using a light band.
4. Glute bridges — lie on back, knees bent feet planted, lift hips without arching.
5. Reverse lunge — step back into split stance, lower rear knee and drive through front foot.
6. Push-up Plus — high plank with straight elbows, push floor away to protract shoulder blades without bending elbows.

### `docs/exercise-atlases/finish.webp`

1. Light band face pull — pull light band toward forehead, elbows high with forearms angled upward.
2. Dead hang — hands overhead on bar, feet can touch floor for assistance, relaxed ribs, controlled shoulder position.
3. Doorway chest stretch — bent forearm against doorway, gently step forward with chest.
4. Hip-flexor stretch — half-kneeling, tuck pelvis and gently shift forward without arching.
5. Calf stretch — face wall, rear leg straight with heel flat, lean forward.
6. Thoracic extension — seated upright with chair back at upper back, hands supporting head, gently extend upper back.

### `docs/exercise-atlases/resilience.webp`

1. Hamstring stretch — heel resting on low bench, soft knee, hinge at hips keeping spine long.
2. Child’s Pose + side reach — kneeling hips toward heels, reach arms forward then walk hands gently to one side.
3. Short-foot / arch hold — bare foot planted, gently shorten the foot by lifting arch without curling toes.
4. Neck isometrics — seated tall, hand lightly resisting front, back, left and right; head remains neutral, no loaded neck movement.
5. Band ankle inversion + eversion — seated heel supported, light band around forefoot; turn sole inward then outward without moving knee.
6. Treadmill / rower — two small demonstrations: easy treadmill walk and seated rowing with legs then body then arms sequence.

### `docs/exercise-atlases/lower-strength-v2.webp`

1. Hack Squat — angled hack squat machine, back and shoulders supported, feet planted; lower with knees following toes and push up.
2. Romanian Deadlift — standing holding barbell near thighs, soft knees, hinge hips back keeping bar close and spine neutral; then stand.
3. Bulgarian Split Squat — rear foot on low bench, front foot forward, descend vertically with front knee tracking toes; then stand.
4. Hip Thrust — shoulders on bench, barbell padded across hips, knees bent; extend hips until torso level without arching.
5. Leg Press — seated at leg press machine, back supported and feet flat on sled, lower within comfortable range then extend without locking.
6. Back Extension — supported at hips on 45-degree back extension bench, hinge hips down with neutral spine, return only to a straight body line.

### `docs/exercise-atlases/lower-accessories-v2.webp`

1. Leg Curl — seated leg curl machine with thighs secured, bend knees to draw padded lever down and back; return slowly.
2. Hip Abduction Machine — seated tall, padded levers outside knees, press knees apart without rocking torso.
3. Hip Adduction Machine — seated tall, padded levers inside knees, draw thighs together without rocking torso.
4. Standing Calf Raise — standing with balls of feet on low step, heels lower then rise tall, ankles straight.
5. Seated Calf Raise — seated knees bent at 90 degrees, load over thighs, heels lower then lift through balls of feet.
6. Tibialis Raise — lean upper back against wall, heels planted slightly forward, lift toes toward shins then lower.

### `docs/exercise-atlases/push.webp`

1. Incline DB Press — on low incline bench with two dumbbells, elbows comfortably below shoulders, press up above upper chest and lower slowly.
2. Flat DB Press — lying on flat bench, dumbbells beside chest with forearms vertical, press up and return slowly.
3. Landmine Press — standing staggered stance holding single end of anchored barbell at shoulder, press up and forward without arching back.
4. Cable Lateral Raise — stand beside low cable, lift working arm out to side up to shoulder height with soft elbow.
5. High-to-Low Cable Fly — standing between high pulleys, soft elbows, arc handles downward and inward to lower chest.
6. Rope Triceps Pushdown — standing at high pulley, elbows tucked, extend forearms downward and gently separate rope ends.

### `docs/exercise-atlases/pull.webp`

1. Chest-Supported Row — chest on incline bench, dumbbells hang below shoulders, row toward ribs while chest stays supported.
2. Neutral-Grip Lat Pulldown — seated at cable lat station gripping parallel handles, draw elbows toward ribs, handle to upper chest without leaning far back.
3. Lat Pulldown / Assisted Pull-Up — illustrate seated wide comfortable overhand pulldown to upper chest, elbows down, no behind-neck pull.
4. Seated Cable Row — seated knees soft with feet braced, pull cable handle toward lower ribs keeping torso still.
5. One-Arm Cable Row — standing split stance at chest-height pulley, pull one handle toward ribs without rotating torso.
6. Face Pull — cable set around face height, pull rope toward forehead and separate hands with elbows out.

### `docs/exercise-atlases/upper-accessories.webp`

1. Reverse Cable Fly — stand between crossed cables, soft elbows, open arms out to sides with chest still.
2. Cable/Prone Y-Raise — lying chest down on incline bench, thumbs up, raise light dumbbells forward into a Y without shrugging.
3. DB Shrug — stand holding dumbbells at sides, lift shoulders straight upward then lower without rolling.
4. Incline DB Curl — seated on incline bench with arms hanging, curl dumbbells without swinging shoulders.
5. Hammer Curl — stand holding dumbbells with palms inward, bend elbows keeping upper arms still.
6. Overhead Cable Triceps Extension — face away from low pulley in split stance, elbows overhead, extend arms without flaring ribs.

### `docs/exercise-atlases/core.webp`

1. Pallof Press — stand side-on to chest-height cable, hold handle at chest then press straight forward resisting rotation.
2. Dead Bug — supine arms up knees at 90 degrees, extend opposite arm and leg while keeping ribs down and low back gently supported.
3. Side Plank — forearm beneath shoulder, feet stacked or staggered, lift hips to a straight body line.
4. Bird Dog — hands under shoulders and knees under hips, extend opposite arm and leg without arching or twisting.
5. Hanging Knee Raise — hang supported from pull-up bar, gently curl knees upward without swinging.
6. Suitcase Carry — stand and walk with one dumbbell at one side, shoulders level and trunk upright.

### `docs/exercise-atlases/arms-and-control.webp`

1. Farmer Carry — walk tall holding two dumbbells at sides, shoulders level, short controlled steps.
2. Wrist Curl — seated forearms supported palms up with wrists just beyond knees, curl light dumbbells at wrists only.
3. DB Pronation/Supination — seated elbow supported at 90 degrees, hold very light dumbbell and slowly rotate forearm palm up and down.
4. Cable/Band External Rotation — elbow against side at 90 degrees, forearm rotates outward against light cable without torso turning.
5. Cable/Band Internal Rotation — elbow against side at 90 degrees, forearm rotates inward across abdomen against light cable.
6. Seated Psoas March — seated tall at bench edge, alternately lift a bent knee toward chest without rounding back.

## Technique references

- [NASM Romanian deadlift](https://www.nasm.org/resource-center/exercise-library/dumbbell-romanian-deadlift)
- [North American Spine Society cervical exercise guide](https://www.spine.org/Portals/0/Documents/KnowYourBack/CervicalExercise.pdf)

Illustrations are orientation aids. Written cues identify the primary variation for exercises with alternatives. The exercise plan and dosage are supplied by the owner.


## Targeted visual corrections

- Back extension: corrected only the bottom-right tile so the finish stops at a straight diagonal body line rather than extending the lower back. Other five tiles were preserved.
- Leg curl: corrected only the top-left tile to show seated knee flexion, with the heels moving downward and back under the seat, rather than leg extension. Other five tiles were preserved.

The app references individual exercise files, never the combined source sheets. Crop bounds are measured from each sheet, with a one-pixel inset to avoid divider lines.
