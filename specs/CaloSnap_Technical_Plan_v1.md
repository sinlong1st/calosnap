# CaloSnap — Technical Architecture & Implementation Plan v1.0

**Status:** Proposed for Product Owner review — NOT permission to implement/deploy  
**Scope:** Private adult-user mobile MVP  
**Design source:** `CaloSnap UI Design v1.html` (Garden design direction; see separate design handoff)

## 1. Confirmed product decisions

- Mobile-first, iOS/Android via Expo/React Native.
- Camera capture or gallery upload; one still image analyzed per scan. Live video recognition deferred.
- Auto mode: no follow-up questions; display assumptions.
- Precision mode: up to 3 prioritized, skippable, targeted follow-up questions; **Skip this question** differs from **Use current estimate**.
- Structured item/ingredient/portion breakdown; user can add/remove/edit items and quantities.
- Estimated calories and protein/carbs/fat, with provenance/uncertainty; avoid unsupported accuracy claims.
- Five goals: Weight Loss, Healthy Gain, Bulk, Cut, Maintain.
- Estimated daily calories/macros from an adult profile with manual override and explicit review.
- Meal Fit based on daily targets and logged intake; no medical advice.
- Explicit **Save to Diary** only; scans and draft edits never affect consumed totals.
- Home dashboard, History, Settings; private release.
- Deferred: continuous live video, medical nutrition plans, recipes, progress charts, food memory.

## 2. Proposed stack

- **Mobile:** Expo/React Native + TypeScript, React Navigation; use the current compatible Expo Camera/ImagePicker packages. Keep design tokens/components in mobile repo. React Native Web is optional, not an MVP dependency.
- **Backend:** Python 3.12, FastAPI/Uvicorn, Pydantic v2, SQLAlchemy 2.0, Alembic; pytest.
- **Database:** Separate SQLite file, WAL as appropriate, short write transactions, persistent mounted volume; store timestamps in UTC with user-local meal date/timezone for daily aggregation. Reconsider PostgreSQL only for real concurrency/scale.
- **AI:** Vision model API called server-side through provider abstraction; structured output with strict Pydantic validation, bounded retries. Verify model compatibility, latency and pricing during a small spike. Never ship API keys inside mobile app.
- **Nutrition:** FoodData Central API and a curated reference layer; cache matched food records with FDC ID, source, per-100g nutrients, data-version; manually curated composite food recipes only with provenance. Be explicit about unavailable matches.
- **Hosting:** Separate Docker Compose project on existing DigitalOcean Droplet *only after* resource/backup audit. Separate volumes, env, process names, port/internal route, credentials and deployment rollback from StockPulse.

## 3. Backend modules

```text
backend/app/
  api/                 # versioned routers + request/response schemas
  core/                # config, auth, errors, security, logging
  models/              # ORM tables
  db/                  # session and migration integration
  scan/                # scan-session state machine + orchestration
  vision/              # provider adapter, prompt/schema, image safety
  food_catalog/        # FDC lookup, matching, curated references, cache
  nutrition/           # deterministic calculation and uncertainty handling
  goals/               # deterministic calorie/macro target rules
  diary/               # saved meal CRUD + daily aggregates
  tests/
mobile/src/
  navigation/ screens/ components/ features/ theme/ api/ state/
```

Keep modules in **one application deployment**, not microservices.

## 4. Scan state machine

`CREATED -> IMAGE_READY -> ANALYZING -> (QUESTIONS_PENDING | REVIEW_READY) -> REVIEW_READY -> SAVED`

Allow `FAILED`, `CANCELLED`, `EXPIRED` from appropriate draft states. `SAVED` is immutable regarding creation; subsequent edits use a meal-edit endpoint with version checks. Duplicate save requests with identical idempotency key return the same meal, not two meals.

- **Auto:** identify -> match catalog -> calculate -> review; no follow-up.
- **Precision:** identify -> select at most 3 high-value questions -> user answers or skips individually -> update draft / recalculate -> review. Provide **Use current estimate** to finish early. Do not automatically shrink uncertainty range by a fixed number.
- Edits to grams, ingredients and cooking method recalculate nutrition and Meal Fit. Only recognition-changing edits require a new model call, and only on explicit action if needed.
- No actual food identified, non-food images, missing matches, or provider failures produce recoverable and honest error states.
- Do not store images long-term by default; use ephemeral processing and secure deletion after request/session expiry. Photo retention opt-in is a later feature unless required for private testing.

## 5. Data contracts (conceptual)

`ScanSession`: id, owner_id, mode, status, image_ref(optional short-lived), created_at, expires_at, updated_at, model_name, model_version, input_hash(optional), schema_version.

`FoodItemDraft`: id, scan_id, name, normalized_name, estimated_grams, min_grams/max_grams(optional), observation_status(seen/estimated/assumed), source_notes, catalog_food_id(optional), source_confidence_label(optional), cooking_method, nutrients, uncertainty_notes.

`PrecisionQuestion`: id, scan_id, order, question_text, response_type, options, reason, affects_item_ids, answer(optional), skipped, impact_priority.

`FoodCatalogEntry`: id, FDC ID or curated reference ID, data_type, canonical_name, nutrients_per_100g, reference_url, source_version, fetched_at, unit_basis.

`UserProfile`: id, age/adult eligibility, height_cm, weight_kg, physiological equation input, activity_level, goal, timezone, consent/preferences. Keep personal data minimal.

`NutritionTarget`: id, owner_id, mode(recommended/custom), kcal, protein_g, carbs_g, fat_g, formula_version, effective_from, effective_to, revision, source_inputs_snapshot.

`Meal`: id, owner_id, scan_id(optional), display_name, meal_type, eaten_at_utc, local_date, timezone, total_kcal, protein_g, carbs_g, fat_g, created_at, revision.

`MealItem`: id, meal_id, name, grams, nutrient values, reference_id, assumptions, edited_by_user.

Only save a **snapshot** of reviewed nutrition values to Meal; never recalculate past consumed totals from changes in a catalog entry. Preserve target history and snapshots for historical dashboard interpretation.

## 6. Calculation rules

- Nutrient quantity = grams * nutrient-per-100g / 100. Sum components, preserve floating point/decimal precision internally, round once for display.
- Mixed meals should be broken into components where feasible. Oils, dressings, sauces and hidden ingredients need explicit assumption labels.
- Keep uncertainty separately from a single central estimate. Do **not** claim statistical confidence intervals unless calibrated against measured ground truth. Use qualitative confidence/estimated bounds with evidence notes.
- Meal fit uses saved meal plus daily consumed totals and current applicable target; separate this from recognition and catalog calculation.
- REE/TDEE and macro presets in **versioned, centralized, testable configuration**, not UI constants. Adult-only automatic recommendation; manual override never silently replaced. Health-related targets requiring clinical judgment deferred.
- Reconcile the previous contradictory *proposed* gym cut rules (fixed kcal offset vs percentage, protein 1.8 vs 2.5 g/kg) **before implementing defaults**. Mark as unresolved product decision, not an AI choice.
- When user changes goal/weight/activity, preview recommended changes; ask before applying. Manual mode remains unchanged without consent.

## 7. API proposal (v1, subject to design review)

| Method | Endpoint | Function |
|---|---|---|
| GET/PUT | `/api/v1/profile` | Profile read/update |
| POST | `/api/v1/goals/calculate` | Preview deterministic targets, does not persist |
| GET/PUT | `/api/v1/goals/current` | Active recommended or custom goals |
| GET | `/api/v1/goals/history` | Versioned targets |
| POST | `/api/v1/scans` | Start session; upload image; choose mode; get status/result |
| GET | `/api/v1/scans/{id}` | Poll or fetch current draft |
| POST | `/api/v1/scans/{id}/answers` | Answer/skip a question; return updated draft |
| POST | `/api/v1/scans/{id}/finish-questions` | Use current estimate; go to review |
| PATCH | `/api/v1/scans/{id}/items/{item_id}` | Edit portion/ingredient and recalculate |
| POST | `/api/v1/scans/{id}/items` | Add a draft ingredient |
| DELETE | `/api/v1/scans/{id}/items/{item_id}` | Remove draft ingredient |
| POST | `/api/v1/scans/{id}/save` | Explicit idempotent Save Meal |
| GET | `/api/v1/diary?date=...` | Saved meals for local date |
| GET | `/api/v1/dashboard?date=...` | Daily aggregate and target |
| GET/PATCH/DELETE | `/api/v1/meals/{id}` | Read/update/delete saved meal |
| GET | `/api/v1/health` | Health check |

Async `202 Accepted` + polling is optional if AI analysis cannot safely complete in a bounded HTTP request. Avoid introducing a queue until actual latency/reliability justifies it. Define API errors and status transitions as typed enums.

## 8. Security/privacy and reliability

- Private MVP still needs **real access control** if exposed via internet: single-owner authentication with properly hashed credentials or trusted identity provider; no shared hardcoded login or unauthenticated endpoints. Auth options should be evaluated before implementation.
- TLS, secrets only on server, input-size/MIME/dimension checks, safe image decoding, EXIF stripping, rate limiting, bounded vision calls, request timeouts, budget ceiling, redacted logs.
- Third-party vision service receives processed photos; tell users this accurately. Review provider retention policy and settings before using real personal images.
- Back up SQLite via a database-safe backup method while running, validate restore, and store backup outside the Droplet. Separate volume from StockPulse.
- Scanning and Save require internet for MVP. Previously cached history may be readable offline; don't promise queued offline saving.
- Ensure retrying save or refreshing results never adds duplicate diary entries.
- No user health diagnoses; no automatic disease-specific dietary advice.

## 9. DigitalOcean coexistence gate

**Before altering the existing Droplet**, obtain baseline `free -h`, `df -h`, `docker stats --no-stream`, `docker ps`, Compose manifests, DB mount mapping, and backups. Protect all secrets before sharing outputs. Verify StockPulse data persistence, backup and restore path. Stopping StockPulse containers can free RAM, but does not reduce Droplet billing. Do not delete volumes, run `docker compose down -v`, or alter StockPulse Compose or ports.

CaloSnap deploy has its own working directory, compose project name, named volume/bind mount, env file, reverse-proxy route, health check and rollback instructions. Deploy after local mobile/backend tests pass.

## 10. QA plan

**Unit:** REE/TDEE and preset formulas, calorie/macro conservation and rounding, unsupported profiles, catalog matching logic, item edits, missing nutrients, local date/timezone behavior.

**Backend integration:** Structured vision results validated; malformed JSON rejected; catalog unavailable fallback; AI timeout; Retry/429; idempotent Save; state transition authorization; user isolation; database migration/restore tests.

**Mobile:** Camera/gallery permissions, upload spinner/cancel, Auto no questions, Precision 0–3 questions with skip/use estimate, editable ingredients, loading/empty/failure states, confirmation before Save, daily total updates only after Save, manual goal override persists.

**E2E:** Normal photo -> Auto -> review -> edit -> save -> Home -> History; photo -> Precision -> skip/answer -> review -> save; cancel without save leaves diary unchanged; offline reentry and errors.

**Accuracy evaluation:** Create a small measured-meal benchmark including Vietnamese mixed dishes, hidden oil/sauces and containers with ambiguous dimensions. Compare AI ingredient recognition and calories against weighed/verified data; report median absolute error, percentage errors where meaningful, failure rate and latency. Do not promise a numerical accuracy level without measurements.

## 11. Build roadmap / approval gates

**Gate 0 — Review architecture:** Resolve auth, provider shortlist/model, food catalog fallback, profile rule conflicts, photo retention, infrastructure fit; sign off on API contracts.

**Slice 1 — UI with mocks:** Implement Garden tokens/components, onboarding, Home, Scan/Preview, Precision, Results, Edit, Diary/History, Settings, error states; demo full navigation with local mock data.

**Slice 2 — Local core backend:** SQLite/Alembic, profile/targets, deterministic nutrition calculator, typed API, unit tests; fake vision provider; integration with mobile.

**Slice 3 — Real scan:** Camera/gallery, image validation, vision API, structured recognition, food catalog matching, uncertainty labels, Auto flow; budget/latency measurements.

**Slice 4 — Precision and corrections:** Question prioritization, skip/finish, recalculation, results edit; test with representative meals.

**Slice 5 — Diary and Goal Fit:** Explicit save with idempotency; dashboard, history, editable saved meals, goal fit and target versioning.

**Slice 6 — Private deployment:** Restore-tested backups, resource audit, separate Compose app, HTTPS/auth, EAS mobile build and real-device QA. Do NOT stop or alter StockPulse until owner approves a validated backup/stop plan.

At every gate: Claude provides changed files, screenshots/logs, test results, known issues, and waits for Product Owner approval.

## 12. Claude Code handoff instructions

Read this plan **and** the actual CaloSnap design/handoff files. Compare them for discrepancies. Do not infer unapproved formulas from mock UI. Produce a one-page Architecture Decision Record (ADR), a dependency/risks list and an implementation roadmap first. **Do not code, install, deploy or touch StockPulse until explicitly approved.**

## References

- USDA FoodData Central API: https://fdc.nal.usda.gov/api-guide/
- USDA FoodData Central data documentation: https://fdc.nal.usda.gov/data-documentation/
- OpenAI image analysis overview: https://developers.openai.com/api/docs/guides/images-vision
- Expo ImagePicker: https://docs.expo.dev/versions/latest/sdk/imagepicker/
- DigitalOcean powered-off Droplets billing: https://docs.digitalocean.com/reference/doctl/reference/compute/droplet-action/power-off/
