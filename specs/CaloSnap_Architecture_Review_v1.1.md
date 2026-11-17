# CaloSnap — Architecture Review & Final Technical Decisions v1.1

**Status:** For Product Owner approval. Nothing here authorizes implementation, installation, or deployment, and nothing here changes StockPulse.
**Inputs reviewed:** `specs/CaloSnap_Technical_Plan_v1.md` (Plan v1.0); `design/…/design_handoff_calosnap_mvp/README.md` and `tokens.json` (UI Design **v1.1**, approved); StockPulse `docker-compose.yml`, `Dockerfile`, `DEPLOY.md` (read-only, to check how the two apps would share the Droplet).
**Date:** 2026-11-16

### Legend

| Tag | Meaning |
|---|---|
| ✅ **APPROVED** | Already approved in Plan v1.0 §1 or Design v1.1 (rules 1–4, §5, §8, §9). Not reopened here. |
| 🟦 **RECOMMENDED** | Architect decision. It becomes final when the PO signs this document. |
| ❓ **PO DECISION** | Product, cost, or health-policy choice. Implementation of the dependent part waits for it. |

---

## 0. Executive summary

Plan v1.0 is sound in direction: a modular monolith, FastAPI, SQLite, a server-side vision call, deterministic nutrition math, and explicit save. **Five changes** make it simpler, cheaper, and consistent with the approved design:

1. **The scan draft lives on the phone. The server is authoritative only at save.** The design requires a Precision answer to recalculate and auto-advance within **300 ms** (Design §5). A per-edit server round-trip cannot meet that reliably. The Plan's server-side draft endpoints for item edits (`PATCH/POST/DELETE /scans/{id}/items`, `/answers`, `/finish-questions`) are therefore replaced by client-side recalculation with a shared, fixture-tested calculator. The server recomputes every value from its own catalog when the meal is saved.
2. **One vision call per scan, in both modes.** The model always returns items plus up to 3 questions. Each answer option carries **typed, deterministic effects**, such as "set rice grams to 150–200 g". Auto mode hides the questions. Precision mode shows them. "Refine with Precision" on R1 needs no second call. This keeps cost and latency fixed per scan.
3. **The food catalog is a local SQLite import of USDA FDC Foundation + SR Legacy plus a curated table (Vietnamese components, aliases).** There are no runtime FDC API calls. This removes an external dependency, rate limits, and latency, and gives a pinned data version.
4. **Missing pieces the design needs are added:** food search (Add item / Change food sheet), a days/range endpoint for the 7-day strip, a daily scan limit with a budget ceiling, a meal-type default, and a server-side token-based auth model.
5. **Hosting is its own Compose project, `calosnap`, on the Droplet, with Caddy as the only published service, an API container with a memory cap, and images built off-box.** StockPulse's files, ports, volumes, and containers are not touched. The first step is a read-only audit.

The biggest risks: (a) **cost abuse of the paid vision API** if the public endpoint is weakly protected; (b) **food-matching quality for Vietnamese mixed dishes**; (c) **memory headroom on the shared Droplet**; (d) **target formulas are not yet approved**, and the mock numbers come from rules the design itself removed (see §6.1).

---

## 1. Requirements: approved vs. unresolved

### 1.1 Approved (✅, not reopened)

| # | Requirement | Source |
|---|---|---|
| A1 | iOS/Android, Expo/React Native; one still photo per scan (camera or gallery); live video deferred | Plan §1 |
| A2 | Auto asks nothing and shows its assumptions. Precision asks ≤ 3 prioritized, skippable questions. "Skip question" ≠ "Use current estimate" | Plan §1, Design §5 |
| A3 | Item/ingredient/portion breakdown; user can add, remove, and edit items and grams | Plan §1, Design R1/R2 |
| A4 | kcal shown as a range with a most-likely value; per-item basis Seen / Estimated / Assumed / You set; no unsupported accuracy claims | Design rules 2, §7 |
| A5 | Five goals: Weight Loss, Healthy Gain, Bulk, Cut, Maintain | Plan §1 |
| A6 | Adult-only automatic targets (≥ 18); manual override; `active = manual ?? recommended`; profile changes never overwrite manual | Design §10, rule 4 |
| A7 | **Scan ≠ eaten.** Only Save on R1 writes to the diary; drafts never touch totals | Design rule 1, §8 |
| A8 | Saved meals store a nutrition **snapshot**; past days keep the targets that were active on that day | Plan §5, Design §10 |
| A9 | Offline: cached Home/History are read-only. Analyze and Save need a connection. No sync queue, no auto-retry | Design §8 |
| A10 | Draft lives in memory. Backgrounding keeps it; killing the app discards it (MVP) | Design §8 |
| A11 | Copy v1.1 used verbatim, including privacy and consent copy | Design §9 |
| A12 | One deployable app (not microservices); separate from StockPulse; no API keys in the mobile app | Plan §2–3 |
| A13 | No medical advice; no disease-specific guidance | Plan §8 |
| A14 | Saved meal can be edited and deleted; Undo toast deletes the just-saved meal | Design §6, §8 |

### 1.2 Unresolved: needs a PO decision (❓)

Each item is detailed in the section shown.

| ID | Decision | Detail | Blocks |
|---|---|---|---|
| D1 | Nutrition-target formula set (equation, activity factors, goal adjustments, macros, floors, rounding, eligibility) | §6 | Phase 5 defaults (UI can use fixtures) |
| D2 | Vision AI provider + model (chosen by a measured spike) and its retention/training terms | §3.4, Phase 2 | Consent copy, Phase 3 |
| D3 | Unmatched food policy: include with an AI-estimated value (recommended), or exclude | §3.5 | Phase 3 |
| D4 | Auth model for the private MVP | §7.1 | Phase 2 API |
| D5 | Daily scan limit, monthly AI budget ceiling, and whether the limit is shown to users | §7.3 | Phase 3 |
| D6 | Photo retention: recommended "server never stores; thumbnails on device only" | §3.6 | Phase 1 (U1 toggle copy) |
| D7 | Public endpoint method: Caddy + domain (recommended), Cloudflare Tunnel, or Tailscale-only | §8.3 | Phase 6 |
| D8 | Platforms for the private release. iOS device installs require an Apple Developer membership (annual fee); Android APK sideload is free | §8.6 | Phase 6 |
| D9 | Meal-type time defaults (proposed: Breakfast < 10:30, Lunch < 15:00, Snack < 17:30, else Dinner) | Design §12.8 | Phase 5 (default only) |
| D10 | Units/locale: store metric; display metric/imperial? Vietnamese UI copy in MVP? | Design §12.10 | Phase 1 |
| D11 | A1 "detected food labels fade in on the photo": defer (recommended) or accept the cost of streaming + positions | §2.3 | Phase 3 |
| D12 | Meal Fit: projected bars + "kcal left after this meal" only, with **no verdict label** (recommended) | §2.3 | Phase 5 |
| D13 | Droplet capacity: if the audit shows < ~350 MB free RAM, choose between adding swap (host change) and resizing (cost) | §8.2 | Phase 6 |
| D14 | Icon library (Phosphor / Lucide) and licensed O1 hero photo | Design §12.9 | Phase 1 polish |

---

## 2. Gap & consistency review (Plan v1.0 ↔ Design v1.1)

### 2.1 Inconsistencies

| # | Plan v1.0 says | Design v1.1 says | Resolution |
|---|---|---|---|
| I1 | The server holds the draft; each item edit is a `PATCH` that recalculates | Answer tile → recalculate → auto-advance in 300 ms; draft kept in memory; killing the app discards it | 🟦 Client-side draft + shared calculator; server recomputes at save (§4) |
| I2 | Server states include `QUESTIONS_PENDING` and `IMAGE_READY` | Client lifecycle `idle → capturing → previewing → analyzing → questioning → recalculating → reviewing → saving` | 🟦 Server keeps a 6-state scan record. The questioning and review states live on the client only (§4.1) |
| I3 | `POST /scans/{id}/save` | Saved-meal review edits through the same R1 UI; Undo deletes | 🟦 `POST /meals` (with optional `scan_id`) + `PATCH/DELETE /meals/{id}` with revision checks |
| I4 | "Photo retention opt-in is a later feature" | U1 has a "Keep meal photos" toggle; History meal cards have 58 pt thumbnails | ❓ D6. Recommended: thumbnails stored **on the device only**. The toggle controls device storage, and the server never keeps photos. This satisfies both documents and needs no object storage |
| I5 | `PrecisionQuestion` table with persisted answers | Questions are per-scan and ephemeral | 🟦 Questions live inside `scans.analysis_json`; answers are saved with the meal as `precision_answers` JSON |
| I6 | Separate `/diary` and `/dashboard` | Home needs totals + target; History needs a 7-day strip + a day's meals | 🟦 `GET /days/{local_date}` and `GET /days?from&to` (summary) |
| I7 | `NutritionTarget` with `mode`, `effective_to` | Recommended and manual stored **separately**, both visible on U2 | 🟦 Append-only `target_revisions` row that holds both blocks (§5) |
| I8 | Mock values (2,050 kcal, P 165) | Design says do not use mock rules | ⚠️ The mock reproduces exactly Mifflin-St Jeor × 1.725 − 15 % (rounded to 50) and 2.5 g/kg protein. These are the rules the design **removed**. Fixtures must not be read as approved defaults |

### 2.2 Gaps (needed, absent from Plan v1.0)

| # | Gap | Added in |
|---|---|---|
| G1 | **Food search** for "Add missing item" / "Change food" sheets | `GET /foods/search` (§4.3), FTS5 catalog (§5) |
| G2 | **Low-confidence** result path (A2 "Continue anyway") needs a defined signal | `confidence` + rule in §3.3 |
| G3 | **Daily scan limit** (A2 variant) + budget ceiling are not specified | §7.3, D5 |
| G4 | **Real A1 progress stages** ("Identifying", "Estimating portions", "Matching") | `stage` field on the scan; one vision call covers the first two, so "Estimating portions" is timed (allowed by Design §8) |
| G5 | **Question impact enum** (High/Medium) has no derivation | Computed deterministically from the kcal range of the affected items (§3.3) |
| G6 | **Energy source** inconsistency: catalog kcal vs. 4/4/9 from macros | 🟦 Use the catalog energy value (FDC nutrient 1008/2047/2048). Fall back to 4/4/9 only if missing. Targets use 4/4/9 |
| G7 | **Auth token storage on device, revocation, lost phone** | §7.1 |
| G8 | **Consent record** for the first-upload sheet | `profiles.photo_consent_at` |
| G9 | **Account data deletion/export** (health-adjacent data) | Admin CLI in MVP; in-app later |
| G10 | **Target-weight field** (O3 optional) has no stated use | ❓ inside D1 (display only, or used as the protein basis) |
| G11 | **Sex for calculation** only offers Female/Male; no path for users who decline | ❓ inside D1 |
| G12 | **Docker port publishing bypasses `ufw`.** Plan's firewall assumptions would be wrong | §8.3 |
| G13 | **Image builds on a small Droplet can run out of memory** and disrupt StockPulse | Build off-box (§8.4) |

### 2.3 Unnecessary complexity (remove or defer)

| Item | Why | Decision |
|---|---|---|
| Server-side draft CRUD (5 endpoints) | Duplicates client state; adds latency; conflicts with I1 | 🟦 Remove |
| Live FDC API lookups at runtime | Rate limits, latency, outage dependency; data drift | 🟦 Import FDC once into SQLite (versioned) |
| Separate upload step / `IMAGE_READY` | One multipart request does both | 🟦 Remove |
| Job queue / Redis / Celery | One user, one worker; seconds-scale jobs | 🟦 In-process async task + polling; startup sweep marks orphaned `ANALYZING` as `FAILED` |
| React Native Web | Not needed for MVP | 🟦 Out of scope |
| A1 label fade-in on photo | Needs streaming + bounding boxes; low value, extra cost | ❓ D11: defer |
| Meal Fit verdict ("Good fit"/"Too much") | Risk of reading as advice; not in design copy | ❓ D12: projected bars only |

---

## 3. Stack evaluation & AI/nutrition pipeline

### 3.1 Stack verdicts

| Layer | Plan v1.0 | Verdict | Notes |
|---|---|---|---|
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, pytest | ✅ Keep | Same toolchain as StockPulse (shared skills, separate code/repo). **Single Uvicorn worker** (SQLite writer + in-process tasks). |
| DB | SQLite, WAL | ✅ Keep | WAL, `busy_timeout=5000`, `foreign_keys=ON`, short transactions. Postgres only if more than one worker or more than a few users. |
| Mobile | Expo SDK 54 / RN 0.81 / React 19 / TS / React Navigation 7 | ✅ Keep (re-check versions at Phase 1) | Add: **TanStack Query** (server data + persisted offline cache), **Zustand** or a typed reducer for the draft, `expo-secure-store` (token), `expo-image-manipulator` (resize + re-encode), `expo-file-system` (device thumbnails), `@gorhom/bottom-sheet`. |
| AI | Vision API behind a provider abstraction, strict schema | ✅ Keep | One call per scan; structured output; Pydantic validation; one retry on schema failure; hard timeout. |
| Nutrition | FDC API + curated layer + cache | 🟦 Change | Offline import of FDC Foundation + SR Legacy + curated table (§3.5). |
| Tests | pytest; mobile unspecified | 🟦 Add | `jest-expo` + React Native Testing Library; **Maestro** for device E2E (free, YAML); shared calculator fixtures run in both languages. |

### 3.2 End-to-end scan pipeline

```
Phone                                         API (FastAPI, 1 worker)                     External
─────                                         ───────────────────────                     ────────
S1/S2 capture → resize ≤1600px long edge,
  re-encode JPEG q≈0.8 (strips EXIF), ≤1.5MB
Analyze ─ POST /scans (multipart, mode,      → auth, daily-limit + budget check
          Idempotency-Key)                     MIME sniff, size/pixel caps, Pillow decode,
                                               re-encode in memory (never to disk)
                                             ← 202 {scan_id, status: ANALYZING, stage}
A1 polls GET /scans/{id} every 1 s             stage=identifying ── vision call ─────────→ Vision API
                                               validate VisionAnalysis v1 (≤1 retry)    ←
                                               stage=matching ── catalog match (local SQLite)
                                               compute item nutrients, ranges, impact
                                               image bytes dropped from memory
                                             ← 200 {status: READY, analysis…}
Auto → R1 / Precision → P1..P3 (client-only, deterministic effects, instant recalculation)
R1 edits / add / change food (client calc; GET /foods/search)
Save ─ POST /meals (Idempotency-Key)         → recompute from catalog, validate, persist snapshot
                                             ← 201 Meal (or 200 same Meal on replay)
Home/History refetch GET /days/{date}
```

Cancel on A1 → `DELETE /scans/{id}`. The server marks it `CANCELLED` and discards the result if the call completes later; the in-flight provider call is still billed.

### 3.3 Uncertainty, confidence, impact (🟦 deterministic, no invented precision)

- **Per item:** the model returns `grams.low / likely / high`. Nutrients = `grams × per_100g / 100` for each bound.
- **Meal range:** `kcal.low = Σ item low`, `kcal.likely = Σ item likely`, `kcal.high = Σ item high`. Summing bounds is deliberately conservative, and the UI calls it an **estimated range**, never a confidence interval (Plan §6).
- **Unmatched items** (D3) add a ±25 % composition widening on top of the portion range and are labeled "AI estimate".
- **Overall confidence** = the model's `overall_confidence`, **downgraded one level** by the server if any of these is true: an item over 25 % of likely kcal is unmatched; Assumed items make up over 30 % of likely kcal; or the range ratio `(high − low) / likely` is over 0.6. `confidence = low` → client shows A2 "Low confidence" with "Continue anyway". Thresholds are config values to be tuned on the benchmark.
- **Question impact:** for each question, `spread = Σ (kcal.high − kcal.low)` over the affected items. **High** if spread ≥ 35 % of the meal spread or ≥ 150 kcal; otherwise **Medium**. Questions are sorted by spread and capped at 3. No kcal delta is shown (Design §7).
- **Answers:** each option carries effects that set grams (and thus range) for the affected items. The resulting basis stays `estimated`, or becomes `user_set` for an explicit portion. The range narrows only by what the option states. There is **no fixed shrink factor** (Plan §4).

### 3.4 AI response schema (model → server), `vision.v1`

Server-side Pydantic, `extra="forbid"`, strict. The prompt is versioned (`prompt_version`) and stored per scan.

```jsonc
{
  "schema_version": "vision.v1",
  "is_food": true,
  "image_quality": "ok",                 // ok | blurry | dark | partial | multiple_meals
  "meal_name": "Chicken rice bowl",      // ≤ 60 chars
  "overall_confidence": "medium",        // low | medium | high
  "confidence_reason": "Rice depth and dressing amount are hard to see.",  // ≤ 140 chars
  "items": [                             // 1–12 items
    {
      "ref": "i1",                       // ^i[0-9]{1,2}$, unique
      "name": "Jasmine rice, cooked",
      "search_terms": ["rice white cooked", "jasmine rice"],   // 1–4, English, for catalog match
      "category": "grain",               // enum: grain|protein|vegetable|fruit|dairy|fat_oil|sauce_condiment|beverage|dessert|mixed_dish|other
      "basis": "estimated",              // seen | estimated | assumed
      "grams": { "low": 150, "likely": 180, "high": 230 },     // 1 ≤ low ≤ likely ≤ high ≤ 2000
      "cooking_method": "boiled",        // null | raw|boiled|steamed|grilled|fried|deep_fried|stir_fried|baked|roasted|stewed
      "evidence": "Rice fills about half the bowl."            // ≤ 140 chars
    }
  ],
  "questions": [                         // 0–3
    {
      "ref": "q1",
      "text": "How much dressing was on the bowl?",            // ≤ 90 chars
      "reason": "Dressing is mostly oil and hard to see.",     // ≤ 120 chars
      "affects": ["i4"],
      "options": [                       // 2–4 (2×2 grid)
        { "label": "None",   "effects": [ { "op": "remove_item", "item": "i4" } ] },
        { "label": "1 tbsp", "effects": [ { "op": "set_grams", "item": "i4", "grams": { "low": 12, "likely": 15, "high": 18 } } ] },
        { "label": "2 tbsp", "effects": [ { "op": "set_grams", "item": "i4", "grams": { "low": 25, "likely": 30, "high": 35 } } ] },
        { "label": "More",   "effects": [ { "op": "set_grams", "item": "i4", "grams": { "low": 40, "likely": 50, "high": 70 } } ] }
      ]
    }
  ]
}
```

**Allowed effect ops:** `set_grams`, `remove_item`, `set_cooking_method`, and `add_item` (an item object as above with a new `ref`).

**Server validation beyond the schema:**
- Every `affects` and effect `item` must reference an existing or added ref.
- `is_food=false` → `FAILED(no_food)`.
- `image_quality` other than `ok` passes through as an S2-style warning on R1. It is not a failure.
- Any text field is treated as **data**. It is never rendered as HTML and never used to choose code paths beyond enums. This limits prompt injection from text inside photos.

**Retry policy:** one re-ask with the validation errors attached. A timeout (provider call ≤ 30 s, total job ≤ 45 s) or a second failure → `FAILED(service_error)`.

### 3.5 Food catalog & matching (🟦)

- **Data:** FDC **Foundation + SR Legacy** CSV (generic foods, ~8–9k rows, a few MB once only energy/protein/carbs/fat/fiber are kept), imported by a script into `food_catalog` with `source='fdc'`, `source_ref=fdc_id`, `data_version` = the FDC release.
- **Curated layer:** `source='curated'`, starting with ~100–200 entries for common Vietnamese components and dishes (cơm tấm rice portions, nước mắm, phở broth, fried shallots, etc.). Each row needs a `reference_url` or `curation_note` (provenance is required by Plan §2). Branded foods are excluded from MVP.
- **Aliases:** `food_aliases(alias, food_id, locale)` for English/Vietnamese synonyms. Search uses SQLite **FTS5** over name + aliases.
- **Matching order:** exact alias → FTS rank on `search_terms` filtered by `category` → if the best score is below threshold, the item is **unmatched**.
- **Unmatched (❓ D3):** recommended is to keep the item, using AI-estimated per-100 g values, badged "AI estimate · no database match", with widened range and a confidence downgrade (§3.3). Excluding it would silently under-count calories, which is worse for the user. The AI schema then also returns `per_100g_estimate` for each item. That adds output tokens; use it only when needed.
- A text-only "pick the best of 5 candidates" LLM call is **deferred**, and added only if the benchmark match rate is below 85 %.

### 3.6 Image handling & privacy (🟦, with D6)

- **Client:** resize, re-encode (drops EXIF/GPS), and show the S2 privacy line + first-upload consent (Design §9).
- **Server:** limits of ≤ 2 MB body and ≤ 4096×4096 px; `Image.MAX_IMAGE_PIXELS` set; JPEG/PNG/WebP only (HEIC converted on device); decode and re-encode in memory; image **never written to disk or logs**. Only the SHA-256 and byte size are stored, for cost and debug correlation.
- **Retention:** the server keeps no images. Thumbnails for History are saved **on the device** (`expo-file-system`, ~200 px) only when "Keep meal photos" is on. That makes the U1 copy "Off: we delete photos after analysis" literally true for both server and device.
- **Provider:** before beta, record the chosen provider's retention and training terms and set any available zero-retention or opt-out option (D2). The consent sheet must name the provider.

---

## 4. Final contracts

### 4.1 State machines

**Server: `scans.status`** (persisted, minimal)

```
           POST /scans
               │
               ▼
          ┌──────────┐  vision+match ok   ┌───────┐  POST /meals(scan_id)  ┌───────┐
          │ANALYZING │ ─────────────────▶ │ READY │ ─────────────────────▶ │ SAVED │
          └──────────┘                    └───────┘                        └───────┘
           │   │  stage: identifying → matching   │ ttl 24 h
           │   │                                  ▼
           │   │ DELETE                       ┌─────────┐   (analysis_json purged)
           │   └─────────────▶ CANCELLED ◀────│ EXPIRED │
           ▼                    (from READY too)└─────────┘
        FAILED(reason: no_food | service_error | timeout | budget_exhausted)
```

- Daily-limit rejection happens **before** creation: `429 daily_scan_limit`, and no scan row is created.
- Startup sweep: `ANALYZING` older than 2 min → `FAILED(service_error)`.
- `SAVED` is informational. Deleting the meal (Undo) does not revert the scan. Re-saving the same scan needs a new Idempotency-Key and is allowed (a user may Undo, then save again).
- Low confidence is `READY` with `confidence: low`, not a failure.

**Client: draft** (✅ Design §8, typed reducer; unit-tested transition table)

```
idle → capturing → previewing(mode) → analyzing(scan_id)
analyzing → failed(reason) → previewing | idle
analyzing → offline → analyzing (manual retry) | idle
analyzing → reviewing                         [auto, or precision with 0 questions]
analyzing → questioning(i=0, answers)         [precision, ≥1 question]
questioning(i) --answer→ apply effects, recalculate (sync) → 300 ms → questioning(i+1) | reviewing
questioning(i) --skip→ questioning(i+1) | reviewing
questioning(i) --use current estimate→ reviewing
reviewing --refine with precision→ questioning(first unanswered)   [no new AI call]
reviewing ⇄ editing(item)            (R2: grams, unit, change food, remove; add item)
reviewing → saving → saved → idle    (only transition that writes; invalidates day queries)
saving → saveError → reviewing       (draft preserved, same Idempotency-Key reused)
any → discardConfirm → idle
```

"recalculating" from the design is a synchronous transition, so it completes within one frame.

### 4.2 Shared nutrition calculator (🟦)

- A pure function `calculate(items[]) → {per-item nutrients, totals{kcal{low,likely,high}, protein_g, carbs_g, fat_g}}`, implemented in **Python (authoritative)** and **TypeScript (preview)**.
- Rules:
  - `nutrient = grams × per_100g / 100`.
  - Macros use `grams.likely` (macro ranges are not shown in the design).
  - Keep full float precision and round **only at display**: kcal to nearest 5 for ranges, 1 kcal for item rows, 1 g for macros.
- **Parity guarantee:** `shared/fixtures/calculator/*.json` (input + expected output) runs in both pytest and jest. CI fails on any mismatch beyond 1e-6.
- Meal Fit (✅ projected bars): `projected = Σ saved meals today + this meal (likely)` against the active target for `local_date`. It is a separate function from the calculator, and it only ever reads persisted meals plus the current draft passed in explicitly. Daily-total selectors never accept draft input (enforced by types and tests).

### 4.3 API v1 (FastAPI, JSON, `/api/v1`, bearer token on everything except `health` and `auth/redeem`)

| Method | Path | Purpose | Notes |
|---|---|---|---|
| POST | `/auth/redeem` | Invite code → user + device token | Rate-limited per IP; D4 |
| POST | `/auth/logout` | Revoke this device token | |
| GET | `/me` | User + profile + active target summary | Bootstraps the app |
| GET / PUT | `/profile` | Read/update profile | PUT returns `recommendation_changed` + preview if the recommended target changed |
| POST | `/targets/preview` | Engine output for given inputs; **not persisted** | Returns step breakdown for O5 (`resting_kcal`, `activity_factor`, `goal_adjustment_kcal`, macros, `formula_version`) or `ineligible{reason}` |
| GET | `/targets/current` | `{recommended, manual, active_source}` | |
| PUT | `/targets/current` | Set/clear manual; or accept a new recommended | `If-Match: revision` |
| GET | `/targets/history?from&to` | Target revisions | |
| POST | `/scans` | multipart `image`, `mode` → `202 {scan}` | `Idempotency-Key` header avoids double-billing on retry |
| GET | `/scans/{id}` | Poll; returns `ScanResult` | |
| DELETE | `/scans/{id}` | Cancel/discard | |
| GET | `/foods/search?q=&limit=20` | Catalog search for Add/Change food | Returns `FoodRef` with per-100 g |
| POST | `/meals` | Save (explicit, idempotent) | `Idempotency-Key` required; replay → 200 same meal; same key + different body → 409 |
| GET / PATCH / DELETE | `/meals/{id}` | Saved meal review / edit / delete (Undo) | PATCH needs `If-Match: revision` → 412 on conflict |
| GET | `/days/{local_date}` | Meals + totals + active target for that date | Home H1–H3, History D1 |
| GET | `/days?from=&to=` | Per-day totals + target (≤ 31 days) | 7-day strip |
| GET | `/health` | Liveness + DB check | No auth; no version/secrets leak |

**Key payloads** (abbreviated):

```jsonc
// ScanResult (GET /scans/{id})
{ "id": "scn_…", "status": "READY", "stage": "matching", "mode": "precision",
  "failure_reason": null, "expires_at": "…Z",
  "analysis": {
    "meal_name": "Chicken rice bowl", "confidence": "medium", "confidence_reason": "…",
    "image_quality": "ok",
    "items": [ { "id": "i1", "name": "Jasmine rice, cooked", "basis": "estimated",
                 "grams": { "low": 150, "likely": 180, "high": 230 }, "cooking_method": "boiled",
                 "match": { "status": "matched", "food": FoodRef } , "evidence": "…" } ],
    "questions": [ { "id": "q1", "text": "…", "reason": "…", "impact": "high",
                     "affects": ["i4"], "options": [ { "id": "q1o1", "label": "None", "effects": [ … ] } ] } ],
    "totals": { "kcal": { "low": 610, "likely": 675, "high": 740 }, "protein_g": 42, "carbs_g": 68, "fat_g": 24 } } }

// FoodRef
{ "food_id": "fdc:168878", "source": "fdc", "name": "Rice, white, long-grain, cooked",
  "per_100g": { "kcal": 130, "protein_g": 2.7, "carbs_g": 28.2, "fat_g": 0.3 }, "data_version": "FDC-2024-10" }

// POST /meals request
{ "scan_id": "scn_…", "display_name": "Chicken rice bowl", "meal_type": "lunch",
  "eaten_at": "2026-11-16T12:41:00+07:00", "timezone": "Asia/Ho_Chi_Minh",
  "mode": "precision", "confidence": "medium",
  "items": [ { "name": "Jasmine rice, cooked", "food_id": "fdc:168878",
               "grams": { "low": 150, "likely": 180, "high": 230 }, "basis": "user_set",
               "cooking_method": "boiled", "ai_per_100g": null } ],
  "precision_answers": [ { "question_id": "q1", "option_id": "q1o2" }, { "question_id": "q2", "skipped": true } ] }
```

On save, the server **ignores client nutrient numbers for matched foods** and recomputes from `food_catalog`. `ai_per_100g` is accepted only for items that came from a scan analysis or were added unmatched, and it is bounds-checked: ≤ 900 kcal/100 g, and macro energy consistent within 15 %. `local_date` is derived server-side from `eaten_at` + `timezone`.

**Error envelope** (typed enum codes):

```json
{ "error": { "code": "daily_scan_limit", "message": "…", "retryable": false } }
```

Codes: `unauthorized`, `validation_error`, `image_invalid`, `image_too_large`, `daily_scan_limit` (429), `budget_exhausted` (503), `rate_limited` (429), `scan_not_found`, `scan_expired`, `idempotency_conflict` (409), `revision_conflict` (412), `service_error` (502/503). Each maps 1:1 to a design state (A2 variants, R1 save error, A3).

---

## 5. Final database schema (SQLite, SQLAlchemy 2.0, Alembic)

IDs are prefixed ULIDs stored as TEXT. Times are UTC ISO-8601. Every user-owned table has `user_id`, and every query is filtered by it in the repository layer (tested).

```sql
users            (id PK, display_name, status CHECK(status IN('active','disabled')), created_at)
invites          (id PK, code_hash UNIQUE, created_at, expires_at, used_at, used_by_user_id FK NULL)
auth_tokens      (id PK, user_id FK, token_hash UNIQUE,            -- SHA-256 of 256-bit random token
                  device_label, created_at, last_used_at, expires_at, revoked_at NULL)

profiles         (user_id PK FK, age_years INT, age_recorded_on DATE,  -- design asks age, not DOB
                  sex_for_calc TEXT NULL CHECK(IN('female','male')),    -- D1/G11
                  height_cm REAL, weight_kg REAL, target_weight_kg REAL NULL,
                  activity_level TEXT, goal TEXT, unit_system TEXT DEFAULT 'metric',
                  timezone TEXT, keep_photos_on_device INT DEFAULT 0,
                  photo_consent_at NULL, revision INT, updated_at)

target_revisions (id PK, user_id FK, revision INT,
                  rec_kcal, rec_protein_g, rec_carbs_g, rec_fat_g,     -- NULL if ineligible
                  rec_formula_version, rec_inputs_snapshot JSON,
                  man_kcal, man_protein_g, man_carbs_g, man_fat_g,     -- NULL = no manual
                  active_source CHECK(IN('recommended','manual')),
                  effective_from_utc, created_at,
                  UNIQUE(user_id, revision))
  -- Active target for a local_date = latest revision with effective_from_utc <= end of that local day.

food_catalog     (id PK 'fdc:<id>'|'cur:<slug>', source CHECK(IN('fdc','curated')), source_ref,
                  data_type, name, category,
                  kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g NULL,
                  data_version, reference_url NULL, curation_note NULL, created_at)
food_aliases     (id PK, food_id FK, alias, locale)
food_fts         -- FTS5 virtual table over name + aliases (contentless, rebuilt on import)

scans            (id PK, user_id FK, mode, status, stage, failure_reason NULL,
                  idempotency_key, provider, model, prompt_version, schema_version,
                  analysis_json NULL,                    -- purged on EXPIRED/CANCELLED
                  image_sha256, image_bytes INT,
                  latency_ms, input_tokens, output_tokens, cost_usd_estimate REAL,
                  created_at, completed_at NULL, expires_at,
                  UNIQUE(user_id, idempotency_key))
  INDEX(user_id, created_at)                             -- daily limit + monthly budget sums

meals            (id PK, user_id FK, scan_id FK NULL, idempotency_key, request_hash,
                  display_name, meal_type CHECK(IN('breakfast','lunch','dinner','snack')),
                  eaten_at_utc, local_date DATE, timezone, mode NULL, confidence NULL,
                  kcal, kcal_low, kcal_high, protein_g, carbs_g, fat_g,   -- snapshot, unrounded
                  precision_answers JSON NULL, revision INT DEFAULT 1, created_at, updated_at,
                  UNIQUE(user_id, idempotency_key))
  INDEX(user_id, local_date)

meal_items       (id PK, meal_id FK ON DELETE CASCADE, position INT, name,
                  food_id NULL, food_source NULL, food_data_version NULL,
                  match_status CHECK(IN('matched','ai_estimate','manual')),
                  per100_kcal, per100_protein_g, per100_carbs_g, per100_fat_g,   -- snapshot
                  grams, grams_low, grams_high,
                  kcal, protein_g, carbs_g, fat_g,
                  basis CHECK(IN('seen','estimated','assumed','user_set')),
                  cooking_method NULL, assumption_note NULL)
```

- **Snapshot rule (✅ A8):** catalog updates never change existing `meal_items` or `meals`.
- **Deletion:** meals are hard-deleted (Undo/Delete). Scans keep only metadata after expiry.
- **Pragmas:** `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout=5000`.

---

## 6. Nutrition Goal Engine: decisions requiring PO approval (❓ D1)

The engine is a pure, versioned module: `goals/engine.py`, `FORMULA_VERSION = "targets.v1"`, with every constant in one config table and fully unit-tested. The UI only renders its output (✅ Design §12.1). The values below are **architect proposals for discussion, not approvals.**

| # | Decision | Options | Architect recommendation |
|---|---|---|---|
| F1 | Resting energy equation | Mifflin-St Jeor; Harris-Benedict (revised); Katch-McArdle (needs body fat) | Mifflin-St Jeor (widely used for adults; needs only sex, age, height, weight) |
| F2 | Users who don't give sex for calculation | Require it; use the mean of the female and male equations; manual only | Mean of both equations, with a note that the estimate is less specific |
| F3 | Activity multipliers (5 levels) | 1.2 / 1.375 / 1.55 / 1.725 / 1.9 (standard); a more conservative set | Standard set, with precise level descriptions in O4 copy |
| F4 | Goal adjustment **form** | % of TDEE; fixed kcal; % with min/max clamps | % with clamps (scales with body size; clamps avoid extremes) |
| F5 | Goal adjustment **values** | e.g. Weight Loss −20 %, Cut −15 %, Maintain 0, Healthy Gain +10 %, Bulk +15 % | Starting point for discussion. **The Weight Loss vs. Cut difference must be defined** (e.g. Cut = smaller deficit + higher protein, for training users) |
| F6 | Clamps | Max deficit 750 kcal/day; max surplus 500 kcal/day | As listed |
| F7 | Calorie floor | Never below BMR; or 1,200 (F) / 1,500 (M); or both | Floor = max(BMR, 1,200). Show an explanation when the floor applies |
| F8 | Protein rule (**resolves the 1.8 vs 2.5 g/kg conflict**, Plan §6) | g/kg per goal; % of kcal | g/kg per goal: Maintain 1.4 · Weight Loss 1.6 · Healthy Gain 1.6 · Bulk 1.8 · Cut 2.0. A cap of 2.2 g/kg rejects 2.5 g/kg |
| F9 | Protein weight basis | Current weight; target weight; adjusted weight when BMI ≥ 30 | Current weight, but use weight at BMI 25 when BMI ≥ 30 (avoids excessive targets) |
| F10 | Fat rule | % kcal; g/kg minimum | 27 % of kcal, minimum 0.6 g/kg |
| F11 | Carbs | Remainder; floor | Remainder via 4/4/9. If < 50 g, reduce fat toward its minimum, then flag |
| F12 | Rounding | kcal to 10/50; grams to 1/5 | kcal to nearest 50, protein/fat to nearest 5, carbs = remainder floored to 5 (matches manual stepper steps) |
| F13 | Eligibility | ≥ 18 (✅); upper age bound; BMI guardrail; pregnancy/breastfeeding | Auto targets for ages 18–79. Block Weight Loss/Cut auto-targets when BMI < 18.5 (offer Maintain/Healthy Gain or manual). Self-attest "not pregnant or breastfeeding", otherwise manual path (copy needed) |
| F14 | Target weight (G10) | Display only; used in F9; used for timeline | Display only in MVP (no timelines or projections) |
| F15 | Manual target validation | Design §10 ranges | Accept the Design §10 ranges as is |
| F16 | Recommendation change policy | ✅ Preview + ask; manual never overwritten | Approved. Also define that a new recommended value takes effect from the moment of acceptance, not retroactively |

**Engine output contract** (drives O5 breakdown):

```json
{ "eligible": true, "formula_version": "targets.v1",
  "steps": { "resting_kcal": 1394, "activity_factor": 1.725, "maintenance_kcal": 2405,
             "goal_adjustment_kcal": -361, "floor_applied": false },
  "targets": { "kcal": 2050, "protein_g": 130, "carbs_g": 255, "fat_g": 60 },
  "notes": ["…"] }
```

The numbers above are illustrative only.

**Acceptance for D1:** the PO signs a filled-in version of this table. The engineer encodes it with ≥ 1 golden test per goal × sex option, plus boundary tests (age 18/79, BMI 18.5/30, floor, clamps).

---

## 7. Security, abuse & reliability

### 7.1 Authentication (❓ D4, 🟦 recommended)

**Recommended: invite code → device token.**
- The admin CLI creates a one-time invite. The code is stored as an Argon2 hash and expires in 72 h.
- The app redeems it once and receives a 256-bit random bearer token. The server stores only its SHA-256 hash; the device stores it in `expo-secure-store`.
- Tokens last 180 days with a sliding expiry and can be revoked by CLI. A lost phone means: revoke, then issue a new invite.
- Why: no email or OAuth provider setup and no password reset flow, while still giving real per-user isolation and revocation. It is fine for ≤ 10 private users.
- Upgrade path: Sign in with Apple/Google later, using the same `users` table.
- **Rejected:** a shared hardcoded login, or relying only on an obscure URL.

### 7.2 Threats & controls

| Risk | Control |
|---|---|
| **Paid-API cost abuse** (top risk) | Auth on all scan routes; per-user daily scan limit; global monthly budget ceiling computed from `scans.cost_usd_estimate`; a separate provider API key/project for CaloSnap with a provider-side spending cap (cost cannot spill into StockPulse); Caddy request size limit |
| Malicious images (decompression bombs, parser bugs) | Size/pixel caps, `MAX_IMAGE_PIXELS`, Pillow kept patched, re-encode, memory-only processing, container memory cap |
| Prompt injection via text in photos | No tools in the vision call; strict schema; enums drive logic; server bounds on grams/values; free text rendered as plain text only |
| Credential/secret leakage | Secrets only in `/opt/calosnap/.env` (chmod 600, owned by deploy user), separate from StockPulse; never in the app bundle or logs; redacting log formatter (Authorization, image bytes, profile fields) |
| Health/profile data exposure | TLS only; no CORS (native client); no analytics SDKs in MVP; backups encrypted (`age`) before going offsite |
| Brute-force on invite redeem | 5 attempts per IP per 15 min; 8+ character random codes; constant-time compare |
| Shared-host blast radius | Container runs non-root, read-only rootfs, `tmpfs /tmp`, `no-new-privileges`, no Docker socket, `mem_limit`/`cpus` caps so a CaloSnap failure cannot starve StockPulse |
| Duplicate diary entries | `UNIQUE(user_id, idempotency_key)` on meals; the client reuses the key across save retries |
| Concurrent edits (two devices) | `revision` + `If-Match` → 412 |

### 7.3 Limits (❓ D5, proposed defaults)

- 30 scans per user per local day.
- A monthly budget ceiling in USD, set after the spike measures cost per scan. At 80 %, log a warning (optionally sent to the owner's Telegram later). At 100 %, return `503 budget_exhausted`.
- Global rate limit: 60 req/min per token, plus the auth limit in §7.2.

---

## 8. Lowest-cost hosting on the existing DigitalOcean Droplet (independent of StockPulse)

### 8.1 What StockPulse looks like today (from its repo, read-only)

- One container `stockpulse`. Port published on **`127.0.0.1:8000`** only. State in a **`./data` bind mount** (SQLite). `restart: unless-stopped`. **No reverse proxy and no inbound ports**; the dashboard is reached through an SSH tunnel.
- Docs size the Droplet at **1 vCPU / 1 GB** (actual size unknown; the audit will confirm).
- Implications:
  - CaloSnap is the **first internet-facing service** on this Droplet and needs ports 80/443. Those must be confirmed free.
  - CaloSnap must not use host port 8000, the container name `stockpulse`, or StockPulse's directory.

### 8.2 Phase 6 pre-flight audit (read-only; outputs redacted before sharing)

`free -h`, `swapon --show`, `df -h`, `docker ps`, `docker stats --no-stream`, `ss -tlnp`, `ufw status`, a list of DO Cloud Firewall rules, `docker compose ls`, and the StockPulse data path and backup status.

**Go criteria:**
- ≥ 350 MB RAM available with StockPulse at its normal peak.
- ≥ 3 GB disk free.
- Ports 80/443 free.
- A StockPulse backup exists, taken by its owner's own procedure.

Otherwise ❓ D13: add a 1 GB swapfile (a host-level change that needs approval) or resize the Droplet (a cost). **Stopping StockPulse is not part of this plan.**

### 8.3 Topology (🟦, with ❓ D7)

```
Internet ──443/80──▶ caddy (calosnap project; only published ports)
                       │  TLS (Let's Encrypt, automatic), request body ≤ 3 MB, HSTS
                       ▼  internal docker network "calosnap_net"
                     calosnap-api (uvicorn, 1 worker, `expose: 8000`, NOT published)
                       │  volume calosnap_data → /data/calosnap.db
                       ▼
                 outbound only: Vision API

StockPulse (unchanged): own project, own network, 127.0.0.1:8000, ./data
```

- **D7 options:**
  - **(a) Caddy + a cheap domain** (~$10/yr; a free DNS name such as DuckDNS also works). Recommended: simplest, and TLS ends on our box.
  - **(b) Cloudflare Tunnel.** Keeps the Droplet at zero inbound ports, but Cloudflare decrypts the traffic, including meal photos.
  - **(c) Tailscale-only.** Most private and free, but every tester's phone needs the VPN running.
- **Firewall:** Docker-published ports **bypass `ufw`**. Only Caddy publishes ports, the API uses `expose`, and a DO Cloud Firewall (free) allows 22/80/443 only.
- **Compose project** `name: calosnap` in `/opt/calosnap`, with its own `.env`, network, and named volumes `calosnap_data` and `caddy_data`.
- **Container limits:** API `mem_limit: 320m`, `cpus: 0.75`, healthcheck on `/api/v1/health`. Caddy `mem_limit: 64m`. Log rotation via the `json-file` driver (`max-size: 10m`, `max-file: 3`) so logs cannot fill the shared disk.
- **Expected footprint:** API ~90–140 MB idle, peaks during image decode (images arrive ≤ 1600 px, so decode is ~10 MB). Caddy ~20–30 MB.

### 8.4 Build & deploy

- Images are built **off the Droplet**, in GitHub Actions or locally, and pushed to GHCR (private) or moved by `docker save | ssh docker load`. Building on a 1 GB Droplet risks running out of memory and disrupting StockPulse.
- Deploy: `docker compose -p calosnap pull && up -d`. Alembic migrations run at API start, with a pre-migration DB backup.
- **Rollback:** the image tags of the last two releases plus the pre-migration backup. `docker compose -p calosnap up -d` with the previous tag, then restore the DB if the migration was not backward-compatible.
- **Forbidden by runbook:**
  - Any command without `-p calosnap`.
  - `docker system prune -a --volumes`.
  - `down -v`.
  - Edits outside `/opt/calosnap`.

### 8.5 Backups

- Nightly host cron runs `sqlite3 /…/calosnap.db ".backup …"` through the API container, or Python `sqlite3.backup`. The result is gzipped and `age`-encrypted, then `rclone` uploads it to a free-tier offsite bucket (Backblaze B2 or Cloudflare R2, 10 GB free).
- Retention: 14 daily + 8 weekly.
- **Restore test** at Phase 6 and monthly: restore into a scratch container, then run integrity check + row counts + one `GET /days`.

### 8.6 Cost summary

| Item | Monthly |
|---|---|
| Droplet | $0 incremental (existing) |
| Domain | ~$1 (or $0 with a free DNS name) |
| Offsite backup | $0 (free tier) |
| Vision API | Measured in the spike (per-scan cost × scans). Capped by D5 |
| Mobile distribution | Android sideload $0. iOS needs an Apple Developer membership (annual), D8. EAS free tier, or local builds |

---

## 9. Implementation roadmap (each phase ends at a PO gate)

At every gate the deliverable is: changed files, screenshots/recordings, test results, known issues, and a request for approval. Every phase runs without touching StockPulse.

### Phase 0 — Decisions & ADR (this document)

- **Exit:** PO signs §1.2 (at least D2-shortlist, D3, D4, D6, D10, D11, D12) and the §4/§5 contracts.
- D1 can finish later because the UI uses fixtures, but it is needed before Phase 5. D7, D8, and D13 are needed before Phase 6.

### Phase 1 — Mobile UI with mocks (no backend)

**Scope:**
- Expo app, `theme.ts` from `tokens.json`, primitives (Design §7), and all screens by ID.
- Navigation per Design §5.
- **Typed draft reducer** (§4.1) and the TypeScript calculator + fixtures (§4.2).
- Mock API layer implementing the §4.3 types.

**Acceptance criteria:**
- Every screen in Design §6 is reachable and matches the HTML by ID at 390×844.
- Auto shows 0 questions. Precision shows 0–3 with "1 of N".
- Skip goes to the next question; "Use current estimate" goes to R1. An answer recalculates in under 1 frame and auto-advances after 300 ms.
- No save path exists outside R1.
- Dynamic Type 200 %, Reduce Motion, and VoiceOver/TalkBack labels work per Design §11.

**Unit tests:**
- Reducer transition table: every valid and invalid transition.
- Calculator fixtures.
- Answer-effect application (`set_grams`, `remove_item`, `add_item`, `set_cooking_method`).
- Range-scale end labels.
- Arc segment math (including over-target).
- Manual target validation (Design §10).
- Daily selectors reject draft input.

**Integration:** RNTL flows for S2 → A1 → P1–P3 → R1 → R2 → Save against mocks; offline banner disables Analyze and Save.

**QA checkpoint:**
- Side-by-side screenshot review against the design board on iOS simulator + Android emulator, at 360/390/430 widths.
- A11y pass with a screen reader.

### Phase 2 — Backend core + AI spike (in parallel)

**2A core scope:**
- FastAPI skeleton, config, error envelope, auth (D4), Alembic schema (§5).
- Profile, targets (engine **stubbed** behind its interface until D1).
- Catalog import script (FDC + curated seed), `/foods/search`.
- `/meals`, `/days`.
- Fake vision provider returning fixture `vision.v1` payloads.
- Python calculator sharing the fixtures.

**2B spike scope:**
- Build a measured-meal benchmark: ≥ 30 weighed meals, including ≥ 10 Vietnamese mixed dishes, hidden oil/sauce cases, and ambiguous containers.
- Run 2–3 candidate vision models with `vision.v1`.
- Record schema-valid rate, item recall, catalog match rate, kcal median absolute error and median APE, p50/p95 latency, and cost per scan.

**Acceptance (2A):**
- All endpoints match §4.3 (OpenAPI snapshot committed).
- User isolation proven.
- Idempotent save proven.
- Python and TypeScript calculators agree on all fixtures.

**Acceptance (2B):**
- A one-page spike report → PO picks the provider (D2) and sets the budget numbers (D5).
- No accuracy claim is made beyond the measured figures.

**Unit tests:**
- Calculator; matching ranking.
- Pydantic `vision.v1` validation (valid, malformed, out-of-range grams, dangling refs, > 3 questions, > 12 items).
- Confidence downgrade rules; impact ranking.
- Token hashing/expiry; local_date derivation across timezones and DST.

**Integration tests (pytest + TestClient + temp SQLite):**
- Redeem → me.
- Save replay returns the same meal; same key + different body → 409.
- PATCH meal with a stale revision → 412.
- Cross-user access → 404.
- `/days` totals equal the sum of the saved snapshots.
- Catalog update leaves old meals unchanged.
- Alembic upgrade/downgrade on an empty DB and a seeded DB.

**QA checkpoint:** run the mobile app against the local backend + fake provider; full Auto and Precision flows save correctly.

### Phase 3 — Real scan (Auto)

**Scope:**
- Provider adapter (chosen model), prompt v1, image pipeline (§3.6).
- Async job + polling + stages + cancel.
- Daily limit and budget ceiling.
- A2/A3 states wired to error codes.
- Consent sheet with the provider's name.

**Acceptance:**
- p95 time from Analyze to R1 ≤ 20 s on 4G (otherwise the "Keep waiting" UI covers it).
- 0 images on server disk (verified by test and a filesystem check).
- Non-food photo → A2 "no food".
- Provider timeout → A2 "service error" with a working retry.
- Limit → A2 "daily limit".
- Benchmark rerun on the production pipeline is within 10 % of the spike results.

**Unit tests:** image validator (bomb, wrong MIME, oversize, EXIF removed), provider adapter with recorded responses, retry-once logic, budget arithmetic.

**Integration tests:**
- Fake slow provider → cancel → `CANCELLED`, and the late result is discarded.
- Startup sweep.
- Provider 429/5xx/timeout mapping.
- Malformed JSON → retry → fail.

**QA checkpoint:** a 20-photo real-device session per platform; PO reviews result quality and copy.

### Phase 4 — Precision & corrections

**Scope:** question rendering from real output; effect application; "Refine with Precision" from R1; R2 edit/remove/unit; Add item and Change food via search; unmatched-item display (D3).

**Acceptance:**
- The sequence answer/skip/use-estimate follows Design §5 exactly.
- Each change recalculates instantly and announces through the a11y live region.
- Precision mode never causes a second AI call (verified by provider call count).
- The saved meal equals what R1 showed (server recompute matches the client within rounding).

**Unit tests:** all effect ops incl. invalid refs; basis transitions to `user_set`; portion > 3× AI estimate → confirm prompt; search ranking for Vietnamese aliases.

**Integration test:** a saved payload built from every edit type → server recompute equals the client fixture.

**QA checkpoint:** 10 representative meals run in Auto vs. Precision. Record whether Precision improved the error on the benchmark subset, and report it honestly.

### Phase 5 — Diary, targets & Meal Fit

**Scope:**
- Goal engine implemented per the signed D1.
- Onboarding O1–O6 including the under-18 path.
- U1/U2 with the recommendation-change notice.
- Home H1–H3 with animation + Undo.
- History D1/D2 + 7-day strip.
- Saved meal review/edit/delete.
- Meal-type default (D9).
- Device thumbnails (D6).
- Persisted offline read cache.

**Acceptance:**
- Totals change only after Save, Undo, edit, or delete.
- Undo restores totals.
- A manual target survives profile edits.
- Past days show the target that was active on that day.
- Offline: Home/History readable and read-only.
- Age < 18 → manual-only path.

**Unit tests:** engine golden tests (every goal × sex option, boundaries, floor, clamps, rounding); target-for-date resolution; Meal Fit projection.

**Integration tests:**
- Profile change with manual set → recommended updated, active unchanged, notice flag set.
- Target revision history.
- Meal edit with revision; delete cascades items.

**E2E (Maestro):**
1. Photo → Auto → edit → save → Home → History.
2. Photo → Precision → skip/answer → save.
3. Cancel/discard leaves the diary unchanged.
4. Save failure keeps the draft.
5. Offline reentry.
6. Onboarding (adult and under-18).

**QA checkpoint:** a 3-day dogfood on real devices; PO sign-off on copy and numbers.

### Phase 6 — Private deployment

**Scope:** read-only audit (§8.2) → PO go/no-go → domain/DNS (D7) → `/opt/calosnap` Compose → CI image build → first deploy → backups + restore test → EAS builds (D8) → real-device QA against production.

**Acceptance:**
- StockPulse container ID, uptime, port, and data directory are unchanged before and after (captured in the audit diff).
- CaloSnap health is green over HTTPS.
- Port scan shows only 22/80/443.
- The API is not reachable directly.
- Restore test passes.
- Rollback rehearsed once.
- Budget alarm tested.
- The invite flow works on a clean device.

**Tests:** smoke suite against production (health, auth required, one scan with a test image, save, Undo); TLS check; header check (no server version leak).

**QA checkpoint:** a PO-run checklist on their own device, plus 48 h of watching memory/disk on the Droplet (`docker stats`) with StockPulse running normally.

---

## 10. Approval checklist

- [ ] §2 resolutions (client-side draft; one vision call; local catalog; `/meals`, `/days`, `/foods/search`)
- [ ] §3.4 `vision.v1` schema and §3.3 uncertainty, confidence, and impact rules
- [ ] §4 state machines and API contracts
- [ ] §5 database schema
- [ ] §7 security controls; D4 auth choice
- [ ] §8 hosting topology; D7, D13 when the audit is done
- [ ] §9 phases and gates
- [ ] Open decisions D1–D14 (§1.2), with D1 filled in per §6
