# Handoff: CaloSnap MVP — UI Design v1.1 (Garden)

> Status: **design approved, handoff candidate.** Do **not** start production implementation, backend work or deployment until the Product Owner approves Part B (technical architecture) and Part C (roadmap). The engine, provider and auth decisions are open (see §12).

## 1. Overview

CaloSnap is a camera-first mobile app. It estimates calories and macros from a food photo and checks the meal against the user's nutrition goal. Results can be corrected, and a meal is added to a daily diary only when the user explicitly saves it.

This package covers every MVP screen: onboarding and targets, Home, Scan and analysis states, Precision questions, Results review, ingredient editing, save, the diary, profile, and goals & targets.

Core rules the UI must enforce:

1. **Scan ≠ eaten.** A scan is a *draft*. Only **Save to diary** on Results Review (R1) writes to the diary. Drafts never affect daily totals.
2. **Estimates, not facts.** Calories are shown as a range plus a most-likely value. Every ingredient carries a basis: Seen, Estimated, Assumed, or You set.
3. **Auto asks nothing. Precision asks ≤ 3 questions**, each skippable.
4. **Targets are user-owned.** Recommended and manual targets are stored separately. Profile changes never overwrite a manual target.

## 2. About the design files

The HTML files here are **design references**: prototypes of the intended look and behavior, not production code. Recreate them in the CaloSnap mobile app. The proposed stack is Expo SDK 54, React Native 0.81, React 19, TypeScript 5.9 and React Navigation 7, pending Part B approval. Use idiomatic RN primitives (`View`, `Text`, `Pressable`, `FlatList`, `expo-camera`, `expo-image-picker`, a bottom-sheet library), not web markup.

## 3. Fidelity

**High-fidelity.** Colors, typography, spacing, radii and copy are final for v1.1. Recreate them pixel-accurately at a 390 × 844 pt reference frame (iPhone 14/15). Exceptions:
- **Icons** are placeholder shapes. Choose an icon set (Phosphor or Lucide suggested) and keep the 22 pt size and weights.
- **Food photography** is striped placeholders. Real photos come from the user's camera at runtime. The welcome hero (O1) needs a licensed photo.
- **All nutrition numbers are mock data.** Target values come from the Nutrition Goal Engine (not yet specified). Do not hardcode any formula, multiplier, goal offset or protein rule from the mocks.

## 4. Files

| File | What it is |
|---|---|
| `CaloSnap UI Design v1.1 (standalone).html` | Single-file offline version of the whole board. Open it in any browser. |
| `source/CaloSnap UI Design v1.1.dc.html` + `source/support.js` | Editable source. Open the `.dc.html` from the same folder. All styles are inline; the mock data and interaction state are in the `<script data-dc-script>` class at the bottom. |
| `tokens.json` | Design tokens (color, type, spacing, radius, shadow, motion, sizes). Import into `theme.ts`. |
| `README.md` | This spec. |

Board sections: 00 Cover · 01 Tokens · 02 Components · 03 Navigation & flows · 04 Onboarding · 05 Home · 06 Scan & analysis · 07 Precision & results · 08 History & profile. Each screen has an ID badge (O1, H2, R1…) that the inventory below uses.

## 5. Navigation architecture

```
Root
├─ OnboardingStack (first launch until profile is saved)
│   O1 Welcome → O2 Goal → O3 About you ─┬─ (age ≥ 18) → O4 Activity → O5 Your targets ─┬─ Use → save profile → Tabs
│                                        │                                            └─ Adjust → O6 (sheet) → save → Tabs
│                                        └─ (not eligible) → O3b → O6 (manual only) → save → Tabs
├─ Tabs  [Home | Scan | History]
│   Home (H1/H2/H3) ── avatar → ProfileStack (U1 → U2, O-screens reused for edits)
│   Scan  → opens ScanModal (does not switch tab content; tabs hidden)
│   History (D1/D2) → saved meal → SavedMealReview (R1 in "saved" mode)
└─ ScanModal (full-screen stack, dismiss = discard draft after confirm)
    S1 Camera ─(denied)→ S3
      │ shutter / gallery
    S2 Preview + mode ── Analyze → A1 Analyzing ─┬─ fail → A2
                                                 ├─ offline → A3
                                                 ├─ Auto → R1 Results review
                                                 └─ Precision → P1 → P2 → P3 → (recalculating) → R1
    R1 ── Edit → R2 sheet → R1
    R1 ── Save → close modal → Home (H3 toast)
    R1 ── Discard → confirm → close modal
```

**Precision navigation rules (must match exactly):**
- Tapping an answer tile selects it, recalculates the current estimate, and auto-advances after 300 ms. On the last question it goes to R1.
- **Skip question** moves to the next available question without an answer. On the last question it goes to R1.
- **Use current estimate** ends the question flow immediately and goes to R1.
- **×** (close) on a question asks "Discard this scan?". Confirm discards the draft, cancel stays.
- None of these actions saves. The draft (photo reference, analysis result, answers) is kept in memory until Save or Discard.
- Questions number 1–3 and are ordered by expected impact. If the engine returns fewer than 3, the progress shows "1 of N". If it returns 0, skip straight to R1.

## 6. Screen inventory

| ID | Screen | Purpose | Key states |
|---|---|---|---|
| O1 | Welcome | Product promise and limits | — |
| O2 | Goal | Pick 1 of 5 goals | selected / unselected |
| O3 | About you | Sex for calculation, age, height, weight, optional target weight, units | field focus, validation error |
| O3b | Not eligible | Under 18 (or other engine rule) → manual targets path | — |
| O4 | Activity | Pick 1 of 5 activity levels | selected |
| O5 | Your targets | Show engine result + step breakdown | loading (engine), error |
| O6 | Adjust targets (sheet) | Manual override, carbs = remainder | recommended shown / hidden (O3b path) |
| H1 | Home · empty day | First day or new day | — |
| H2 | Home · in progress | Daily totals from **saved** meals only | offline banner variant |
| H3 | Home · after save | Totals animate, toast with Undo | — |
| S1 | Camera | Capture with framing guide | flash on/off |
| S2 | Preview + mode | Quality check, choose Auto/Precision, privacy line | quality warning, offline (Analyze disabled) |
| S3 | Permission denied | Settings or gallery | camera / photo-library variants |
| A1 | Analyzing | Pipeline progress | > 20 s "Keep waiting / Cancel" |
| A2 | Analysis failed | Recover | no food · low confidence · service error · daily limit |
| A3 | Offline | New analysis needs connection | — |
| P1–P3 | Precision questions | ≤ 3 one-tap questions | unanswered / selected |
| R1 | Results review | Review, refine, edit, save | Auto / Precision badge, offline (Save disabled), saving, save error, saved-meal mode |
| R2 | Edit ingredient (sheet) | Portion, unit, change food, remove | — |
| D1 | History · day | Diary grouped by meal type | offline read-only, past day |
| D2 | History · empty | First use | — |
| U1 | Profile & settings | Goal, targets, body data, privacy | — |
| U2 | Goals & targets | Recommended vs manual, change notice | recommended-only / manual / changed-recommendation |

Not drawn yet but required. Build them from existing components:
- **Discard confirm:** a native action sheet: "Discard this scan?" with Discard (destructive) and Keep reviewing.
- **First-upload consent sheet:** bottom sheet, see §9 copy.
- **Add missing item / Change food search:** sheet with a search field and a result list of rows like the R1 ingredient row.
- **Saved meal review:** R1 layout with the badge "Saved · Lunch 12:41". Footer: Delete (text, danger) and Save changes. Editing recalculates the day.

## 7. Component specs

All values are in pt. Colors refer to `tokens.json`.

**Phone frame / screen:** bg `color.bg`. Horizontal padding is 20 (forms 24). Content starts at y = 62 below the status bar.

**Buttons**
- Primary: height 56 (52 compact), radius pill, bg `primary`, text `onPrimary`, 16/700 (15/700 compact). Pressed: opacity 0.85 plus scale 0.98 over 150 ms.
- Secondary: same size, bg `surface`, 1.5 border `borderButton`, text `text` 15/700.
- Destructive secondary: same as secondary with text `danger`.
- Text button: 14/700 `primary`, underline offset 3. Hit area ≥ 44.
- Disabled: bg `disabledBg`, text `disabledText`, no press feedback.

**Segmented control (Auto/Precision, Female/Male):** track `surfaceSegmented`, radius pill, padding 4, gap 4. Segment height 42–44. Active segment bg `surface`, shadow `segmentActive`, text `primary` 14/700. Inactive text `textMuted`. On camera, the track is `rgba(255,255,255,.10)` and the active segment is `bg` with `primary` text.

**Selectable card (goal, activity, mode):** padding 16 (14 × 16 for mode), radius 20, bg `surface`, 2 border transparent. Selected: bg `accentTint`, border `primary`. Radio: 22 ring, 2 border (`#C9C4B6` off, `primary` on), 10 inner dot. Title 16/700, description 13/500 `textMuted`.

**Input tile (O3):** bg `surface`, radius 18, padding 14 × 16. Label 12/600 `textMuted`, value 24/800 with unit 13/600 `textMuted`. Focus: 2 border `primary`. Error: 2 border `danger` plus helper row (8 dot `danger`, 12/600 `onDangerTint`).

**Stepper:** square buttons 40–56, radius 12–16, 1.5 border `borderControl`, glyph 18–24/600 `primary`. Value 18–32/800 centered. Long-press repeats every 120 ms.

**Calorie arc (Home):** 15 segments, each 34 × 15 with radius 6, on a 112 pt radius semicircle. A segment is filled when `i < round(consumed / target × 15)`, capped at 15. Filled `primary`, empty `arcEmpty`. Center value display 44/800 with label "kcal remaining" 13/500 `textMuted`. When over target, show "X kcal over" in `onEstimateTint`, keep every segment filled, and use no red.

**Macro bar (ledger style):** a label row (13/600, values `textMuted`, "N g left" in bold `text`) above a track 8 high, radius 4, `trackEmpty`, fill `primary`. **Projected** variant (R1 meal fit): a solid "saved today" segment followed by a hatched segment for "this meal", drawn as 45° stripes of `estimate` / `estimateLight` 3 pt wide. Overflow past 100% is clipped, and the label shows the true numbers.

**Calorie range scale:** track 6 `trackEmpty`. Band 14 tall, radius 7, `estimateLight`, from `low` to `high`. Tick 3 × 22 `primary` at `mostLikely`. End labels are `floor(low×0.8/100)×100` and `ceil(high×1.2/100)×100`. These are display bounds only. **Band width must come from the analysis result** (`kcal.low`, `kcal.high`), never from a fixed ±%.

**Confidence dots:** 3 dots, 8 pt. low = 1, medium = 2, high = 3 filled with `primary`; the rest `#DDD8CB`. Always paired with a text label ("Medium confidence") and a one-line reason supplied by the analysis.

**Basis indicator:** 8–9 pt dot plus an optional chip (12/700, padding 6 × 10, radius pill).
- Seen: solid `primary` dot, chip `accentTint` / `primary`.
- Estimated: solid `estimate` dot, chip `estimateTint` / `onEstimateTint`.
- Assumed: 1.5 dashed `textMuted` ring, chip `assumedTint` / `textMuted`.
- You set: solid `accent` dot, chip `accentTint` / `primary`. Appears after the user edits an item in R2.

Never rely on color alone: the chip text or the legend is always present.

**Ingredient row:** min height 56. Layout is dot, then name (14/700) with sub-line "portion · key macro" (12/500 `textMuted`), then kcal (15/700), then an Edit chip (32 tall, radius 10, `surfaceMuted`, 12/700 `primary`). Rows are separated by a 1 pt `lineSubtle` line. The whole row is pressable.

**Answer tile (Precision):** 2 × 2 grid with gap 10. Tile height 64, radius 18, 1.5 border `borderControl`, bg `surface`, 15/700. Selected: bg `primary`, text `onPrimary`.

**Impact chip:** `estimateTint` / `onEstimateTint`, 12/700, 7 pt dot. Copy is "High impact on this estimate" or "Medium impact on this estimate", taken from the question's `impact` enum. Do **not** show kcal deltas unless the engine returns evidence-based values.

**Card:** bg `surface`, radius 24 (Home hero 28), padding 18–20, shadow `card` or none.
**Meal card:** bg `surface`, radius 22, padding 10, 58 × 58 thumbnail with radius 16, title 14/700, meta 13/500, kcal 15/700 aligned right.
**Bottom sheet:** bg `bg`, top radius 28, 40 × 5 handle `borderButton`, scrim `cameraScrim`, shadow `sheet`. Dismiss by dragging down, tapping the scrim, or Done.
**Toast:** bg `primary`, radius 18, padding 14 × 16, 24 pt sage check, 14/600 text, Undo 14/700 `#C9DCC8`. Sits 14 pt above the tab bar, auto-dismisses after 6 s, and announces itself to the screen reader.
**Banners:** offline uses `estimateTint` / `onEstimateTint`; error uses `dangerTint` / `onDangerTint`. Radius 14, padding 10–12 × 14, 13/600, 8 pt dot.
**Tab bar:** height 86 including the home indicator, bg `surface`, top border `line`. Three items. The center Scan item is a raised 60 pt circle `primary` with shadow `scanButton`, offset −28. Labels 11/700; active `primary`, inactive `textSubtle`.
**Camera controls:** shutter is 86 outer with a 4 pt ring `onCamera` and a 68 inner fill. The 52 gallery thumb has radius 14 and a 2 pt border. Glass buttons are 44 circles in `cameraGlass`. The framing guide is a 300 pt dashed circle in `frameGuide` plus 40 pt corner brackets.

## 8. Interactions, states & transitions

**Motion:** sheets slide up over 320 ms on `cubic-bezier(.2,0,0,1)`. Screen pushes use the native stack defaults. Tile selection takes 150 ms, then auto-advances after 300 ms. After a save, the Home arc and bars animate from old to new values over 600 ms. Respect Reduce Motion by replacing these with cross-fades.

**Draft lifecycle (state machine)**
```
idle → capturing → previewing(mode) → analyzing ─┬→ failed(reason) → previewing | idle
                                                 ├→ offline → analyzing (manual retry) | idle (discard)
                                                 └→ questioning(i, answers) → recalculating → reviewing
                                    (auto) ──────────────────────────────────────────────→ reviewing
reviewing ⇄ editing(item)
reviewing → saving → saved → idle        (diary + daily totals update here only)
reviewing → discarded → idle
saving → saveError → reviewing           (draft preserved)
```
- Daily totals read **only** from persisted diary entries. Draft data must never be passed into the Home/History selectors.
- Undo on the H3 toast deletes the just-saved entry and returns the totals.
- If the app is backgrounded during a draft, keep the draft in memory and restore R1 on return. Killing the app discards it (MVP).

**Loading:** A1 shows the steps "Identifying foods", "Estimating portions" and "Matching nutrition data", driven by real pipeline events or timed fallbacks. Detected food labels fade in on the photo. A Cancel text button is always available, and after 20 s the screen offers "Keep waiting" or "Cancel". O5 shows a skeleton of the target card while the engine runs. Save shows an inline spinner in the button and disables it.

**Errors:**
- A2 variants, with headline / action:
  - No food found: "We couldn't find food in this photo" / Retake, Choose another photo.
  - Low confidence: "We're not confident about this meal" / Retake, Continue anyway (goes to R1 with a low-confidence badge).
  - Service error: "Something went wrong on our side" / Try again.
  - Daily limit: "You've reached today's scan limit" / Back to Home (visibility to be decided).
- Save error: an inline error banner on R1 reading "Couldn't save. Your meal is still here." with Try again. The draft stays.

**Empty states:** H1, D2, and the dashed "Not logged · Scan" slot in D1.
**Success:** H3 toast. Targets saved: toast "Targets updated".

**Offline (MVP scope):**
- Cached Home and History can be viewed offline with the amber banner "You're offline. Diary is read-only."
- New AI analysis and Save Meal require a connection. Analyze (S2) and Save (R1) are disabled with the banner shown. A3 appears if the connection drops after Analyze.
- **No background sync, save queue or auto-retry** (deferred). The user retries manually.

## 9. Corrected copy (v1.1, use verbatim)

- **S2 privacy line:** "Your photo is sent to a third-party AI provider for analysis. Nothing is logged until you review and save."
- **First-upload consent sheet (new, shown once):** Title "How photo analysis works". Body: "To estimate nutrition, your photo is sent to a third-party AI vision provider. We don't use your photos for ads. You can choose whether CaloSnap keeps photos in Profile → Keep meal photos." Buttons "Continue" and "Not now". *Final provider name and its retention terms are needed before beta (§12).*
- **S3:** "Camera access is off" / "CaloSnap uses the camera to photograph meals for nutrition analysis. You can also pick a photo from your gallery."
- **A3:** "Waiting for a connection" / "New analysis needs an internet connection. Your photo stays on this phone until you try again or discard it. Saved meals remain viewable offline." Buttons "Try again now" and "Discard photo".
- **O3 privacy note:** "Stored with your account. Never sold or used for ads, and not sent to the AI photo provider."
- **O3 helper:** "Used only to estimate your energy needs. Automatic targets are available for adults 18+."
- **O3b:** "We can't recommend targets automatically" / "Energy needs for people under 18 vary with growth, and our calculation isn't designed for them. You can still use CaloSnap with targets you set yourself, ideally with guidance from a doctor or dietitian."
- **O5 note:** "A starting point from a fixed, documented calculation. Adjust it if your experience differs." The breakdown rows are labels only ("Resting energy", "× Activity: {level}", "Goal adjustment: {goal}"). Values come from the engine response.
- **R1 refine row:** "Refine with Precision" / "Answer up to 3 questions about portions and cooking".
- **R1 footnote:** "Foods and portions are estimated from your photo by a third-party AI service. Nutrition values come from a reference food database. The range reflects how much the photo can show, so treat results as estimates, not exact measurements."
- **U1 photo toggle:** "Keep meal photos" / "Off: we delete photos after analysis". The "How estimates work" page links to the provider's retention terms.
- **Precision buttons:** "Skip question", "Next" / "See results", "Use current estimate".
- **Removed claims:** "could narrow to ±35 kcal", the fixed ±% scale, "isn't uploaded or saved anywhere else", "Photos are only used for analysis", "We'll retry automatically", and the hardcoded −15% / 2.5 g/kg / Mifflin-St Jeor labels.

## 10. Validation requirements

| Field | Rule | Error copy |
|---|---|---|
| Age | Integer. **≥ 18 for automatic targets** (< 18 → O3b). Upper bound from the engine spec (open). Required. | "Automatic recommendations are available from age 18." |
| Height | 120–230 cm / 3′11″–7′7″. Required. | "Enter a height between 120 and 230 cm." |
| Weight | 35–250 kg / 77–550 lb. Required. | "Enter a weight between 35 and 250 kg." |
| Target weight | Optional, same range as weight. | — |
| Sex for calculation | Required for the engine. Explain why it's asked. | — |
| Manual calories | 1,000–5,000 kcal, 50-step. Below 1,200: show a non-blocking note asking the user to check with a professional. | "Enter between 1,000 and 5,000 kcal." |
| Manual protein / fat | 0–400 g / 0–250 g, 5-step. Carbs are derived and must be ≥ 0; otherwise block Save with "Protein and fat exceed your calories." | as noted |
| Ingredient portion | > 0 and ≤ 3× the AI estimate before a confirm prompt. 25 g step (unit-dependent). | — |

Ranges are design proposals. Confirm them with the engine spec.

**Targets data model rule:** store `recommended` (engine output + engine version + inputs snapshot) and `manual` (nullable) separately. `active = manual ?? recommended`. When profile inputs change, recompute `recommended` only. If `manual` exists, show the U2 change notice; never overwrite it. Past diary days keep the targets active on that day.

## 11. Accessibility & responsive behavior

- Text contrast ≥ 4.5:1. `textMuted` #55615A on #F8F5EE ≈ 6.5:1. `onEstimateTint` on `estimateTint` ≈ 7:1. Sage #7FA07E is **only** for fills and dots, never for text or white-on-sage buttons.
- Touch targets ≥ 44 × 44 pt. Answer tiles and buttons are 56–64 tall.
- Support Dynamic Type up to at least 200%. Cards grow vertically. The 3-up macro tiles become a vertical list above 130%. Answer tiles become 1 column above 150%. The arc value may scale down to a 32 pt minimum.
- Screen reader:
  - Arc: "930 of 2,050 calories remaining".
  - Macro bars: "Protein, 88 of 165 grams, 77 left".
  - Range scale: "Estimated 610 to 740 calories, most likely 675, medium confidence".
  - Basis: "Jasmine rice, estimated portion, about 180 grams, 210 calories, edit".
  - Projected bars: "if saved, protein reaches 130 of 165 grams".
- Toasts and recalculated estimates announce through a live region. Focus moves to each sheet's title on open and returns on close.
- Don't rely on color alone: basis, confidence and errors always carry text.
- Reduce Motion: remove the scan-line animation and the arc/bar tweens.
- Layout: phones from 360 to 430 pt wide, portrait only for the MVP. Horizontal padding stays at 20; cards and the 7-day strip flex. Small phones (≤ 667 pt tall) make the screens scroll, and pinned footers stay pinned. Tablets are out of scope.

## 12. Unresolved decisions (need Product Owner / Part B)

1. **Nutrition Goal Engine spec:** energy equation, activity factors, per-goal calorie adjustment, macro rules, rounding, upper age bound, other eligibility rules (pregnancy, medical: deferred). The UI only renders engine output.
2. **Vision AI provider:** vendor, region, data-retention and training terms. These are needed for the consent copy.
3. **Uncertainty model:** how `low`/`high`, confidence and the impact enum are derived (AI portion ranges × food-database variance). The UI never invents ranges.
4. **Food composition data source:** e.g. USDA FoodData Central, plus how matches are traced and shown.
5. **Photo retention default and History thumbnails** (current default: delete after analysis).
6. **Authentication for the private MVP:** email magic link, Apple/Google, or invite code.
7. **Daily scan limit:** value, and whether it is visible to users.
8. **Meal type assignment:** time-of-day defaults (proposed: Breakfast < 10:30, Lunch < 15:00, Snack < 17:30, Dinner after). Editable on R1.
9. **Icon library and the licensed O1 hero photo.**
10. **Units and locale:** metric/imperial switching, and number and date formats.

## 13. Using this handoff in Claude Code

1. Create the **new, separate** CaloSnap repository (do not touch StockPulse). Copy this whole `design_handoff_calosnap_mvp/` folder to `docs/design/` in that repo.
2. Start Claude Code in the repo and give it a scoped first prompt, for example:
   > Read `docs/design/README.md` and `docs/design/tokens.json`. Open `docs/design/CaloSnap UI Design v1.1 (standalone).html` for visual reference. **Do not implement yet.** Propose the Expo + React Native project structure, a `theme.ts` generated from tokens.json, and the component list from §7, with file names. Wait for my approval.
3. After approval, build in small steps, each using **mock data only**: theme → primitives (Button, Card, SegmentedControl, MacroBar, RangeScale, BasisChip, Stepper, Sheet, Toast) → static screens by ID → navigation (§5) → draft state machine (§8). Ask Claude Code to compare each screen against the HTML by ID.
4. Keep the engine and analysis behind typed interfaces such as `NutritionGoalEngine.calculate(profile)` and `MealAnalysis` (`kcal.low/likely/high`, `confidence`, `items[].basis`, `questions[].impact`). Use fixtures until Part B is approved.
5. Make the acceptance criteria tests: drafts never change totals; Precision has at most 3 questions; Skip goes to the next question; Use current estimate goes to R1; there is no Save outside R1; under 18 routes to the manual path; a manual target survives profile edits.
6. To change the design later, edit `source/CaloSnap UI Design v1.1.dc.html` (open it next to `support.js`), then re-export.

## 14. Assets

- Fonts: Plus Jakarta Sans (Google Fonts, OFL), weights 400–800. Geist Mono is used only for board annotations, not in the app.
- No raster assets are included. Photos are placeholders and icons are placeholder shapes (see §3).
- Mock persona: Maya, 31, 168 cm, 66 kg, very active, Gym cut, active target 2,050 kcal (P 165 / C 208 / F 62). Mock lunch: Chicken rice bowl, 610–740 kcal (likely 675), P 42 / C 68 / F 24. **All mock data.**
