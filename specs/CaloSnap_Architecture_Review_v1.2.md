# CaloSnap — Architecture Review v1.2

**Status:** For Product Owner approval. Not authorization to write production code, install packages, deploy, or touch StockPulse.
**Supersedes:** the sections of `CaloSnap_Architecture_Review_v1.1.md` named below. **Every v1.1 section not named here stays in force.**
**Date:** 2026-11-16

| v1.2 section | Replaces / extends in v1.1 |
|---|---|
| §2 Server trust boundaries | Extends §4.2, §4.3 (`POST /meals`, `PATCH /meals`), §7.2. **Replaces the save payload.** |
| §3 Scan job lifecycle | Replaces §4.1 (server state machine) and the async parts of §3.2 |
| §4 Targets during a day & history | Replaces the `target_revisions` resolution rule in §5 |
| §5 Extensible analysis pipeline | Extends §3.2 and §3.4 |
| §6 Cost control | Replaces §7.3 |
| §7 Early vision benchmark | Replaces Phase 2B in §9 (moves it into Phase 1) |
| §8 Curated catalog growth | Replaces the curated-layer sizing in §3.5 |
| §9 Connectivity: Tailscale vs Caddy | Replaces §8.3 (D7) |
| §10 StockPulse isolation rules | Replaces §8.2 (audit command list) |
| §11 Schema delta | Extends §5 |
| §12 Decision register | Replaces §1.2 |
| §13 Remaining blockers / §14 Phase 1 checklist | Replaces Phase 1 in §9 |

**Accepted foundation (PO, v1.1 review):** Expo React Native, FastAPI modular monolith, SQLite, external Vision AI, local food catalog, separate Docker deployment.

---

## 1. What changed in v1.2

1. **The save payload now carries intent only.** The client sends references and grams, never nutrient numbers. The server rebuilds every nutrient value, range, and basis label from data it owns (§2).
2. **Scan jobs follow a lifecycle stored in the database**, with compare-and-set transitions, a deadline, heartbeat, a reaper, boot sweep, cancellation, a cap of 2 provider calls, and graceful shutdown (§3).
3. **Each day's target is frozen in a per-day snapshot.** A change during a day applies to the whole current day, and past days never change (§4).
4. **The one-call pipeline sits behind a step interface**, with a reserved refinement endpoint and an analysis revision number (§5).
5. **Cost control has six layers**, including a provider-side hard cap and a budget reservation taken before each call (§6).
6. **The benchmark moves into Phase 1 (1B)** and runs alongside the UI prototype (§7).
7. **The curated catalog starts with ≤ 40 entries**, and only matching failures that were measured lead to new entries (§8).
8. **For the private MVP, the recommendation is now Tailscale-only access**, through a Tailscale container inside the CaloSnap Compose project. It serves HTTPS on a `ts.net` name and needs no inbound ports and no host-level changes (§9).

---

## 2. Server-side trust boundaries (R1)

### 2.1 Principle

The client is trusted for **intent**: which items, how many grams, which catalog food, and which Precision options were picked.

The server alone is trusted for **values**: nutrients per 100 g, nutrient totals, ranges, basis labels, match status, and confidence. Request models use `extra="forbid"`, so a nutrient field sent by the client is **rejected with 422**. It is never silently ignored.

### 2.2 Revised save payload (`POST /api/v1/meals`; `Idempotency-Key` required)

```jsonc
{
  "scan_id": "scn_…",                 // optional; required if any item.source == "scan_item"
  "analysis_revision": 1,             // must equal the scan's current revision (§5)
  "display_name": "Chicken rice bowl",// ≤ 60 chars; plain text
  "meal_type": "lunch",
  "eaten_at": "2026-11-16T12:41:00+07:00",
  "timezone": "Asia/Ho_Chi_Minh",     // IANA; validated
  "precision_answers": [ { "question_id": "q1", "option_id": "q1o2" },
                         { "question_id": "q2", "skipped": true } ],
  "items": [                          // 1–30
    { "source": "scan_item", "scan_item_ref": "i1", "grams": 180 },
    { "source": "scan_item", "scan_item_ref": "i3", "grams": 90, "food_id": "fdc:171477" }, // "Change food"
    { "source": "catalog",   "food_id": "cur:nuoc-mam", "grams": 10 }                         // "Add item"
  ]
}
```

Scan items that the user removed are simply left out of `items`. **There is no free-text custom food with user-entered nutrition in the MVP.** "Add item" only offers catalog search results; custom foods are deferred.

### 2.3 What the server checks and derives, in order

| # | Check | Failure |
|---|---|---|
| 1 | Bearer token valid; user active | 401 |
| 2 | `Idempotency-Key` seen before for this user: same `request_hash` → return the stored meal (200); different hash → 409 | 409 `idempotency_conflict` |
| 3 | `scan_id` belongs to this user (lookup is `WHERE id=? AND user_id=?`, so a foreign scan looks like a missing one) | 404 `scan_not_found` |
| 4 | Scan status is `READY` or `SAVED`, and `analysis_json` is still present | 410 `scan_expired` (catalog items alone can still be saved) |
| 5 | `analysis_revision` equals the scan's current revision | 409 `analysis_stale` |
| 6 | Every `scan_item_ref` exists in the scan analysis, **or** was added by a Precision option the user picked | 422 `scan_item_not_found` |
| 7 | Every `food_id` exists in `food_catalog`, and `retired_at IS NULL` | 422 `unknown_food` |
| 8 | `0 < grams ≤ 2000` per item; ≤ 30 items; meal total ≤ 10,000 kcal after recomputation | 422 `grams_out_of_range` / `meal_implausible` |
| 9 | Each Precision answer references a real question/option in the scan, with ≤ 1 answer per question | 422 `invalid_answer` |
| 10 | Every item resolves to usable nutrition (2.4) | 422 `nutrition_unavailable` (the user must change the food or remove the item) |

**Derivation (server only):**

1. **Replay.** Start from the stored analysis, apply the effects of the chosen Precision options, and get the "expected draft".
2. **Nutrition per 100 g, for each submitted item:**
   - with a `food_id` (catalog item, or a scan item whose food was changed) → the catalog row's values;
   - a matched scan item → its matched catalog row;
   - an unmatched scan item → the **AI estimate stored at analysis time**, which was already validated (2.4).
3. **Basis:**
   - grams equal the expected draft → keep the AI basis (`seen` / `estimated` / `assumed`);
   - grams differ, or the item is a catalog addition → `user_set`.
4. **Range:**
   - AI-basis items keep the gram range from the expected draft;
   - `user_set` items use `low = likely = high = grams`;
   - AI-estimate items get the composition widening (v1.1 §3.3).
5. **Totals and confidence** are recomputed (v1.1 §3.3). The rows are stored as an immutable snapshot (v1.1 §5).
6. **Response:** the authoritative meal. The client **replaces** its preview with the response. If the two differ by more than rounding, the client records a `calc_parity_mismatch` diagnostic (counter only, no payload) for debugging.

### 2.4 Validating AI-derived nutrition (at analysis time, before anything reaches the client)

The AI returns `per_100g_estimate` **only for unmatched items** (D3: kept, labelled "AI estimate").

| Rule | Action |
|---|---|
| `0 ≤ protein, carbs, fat ≤ 100` and `protein + carbs + fat ≤ 105` g/100 g | Otherwise → `nutrition_unavailable` |
| `0 ≤ kcal ≤ 900` /100 g | Otherwise → `nutrition_unavailable` |
| `abs(kcal − (4P + 4C + 9F)) ≤ max(15 %, 20 kcal)` | Otherwise → replace kcal with the 4/4/9 value and add the note "energy recomputed from macros" |
| Category sanity (soft), e.g. `fat_oil` with kcal < 500, or `beverage` with kcal > 400 | Flag the item and downgrade confidence one level |

The validated estimate is stored in `scans.analysis_json` and becomes the **only** source for that item at save. Items flagged `nutrition_unavailable` are shown on R1 with "Couldn't estimate nutrition. Change food or remove." **Save is disabled until the item is resolved.** Excluding it silently would under-count the meal.

### 2.5 Editing saved meals (`PATCH /meals/{id}`, `If-Match: revision`)

- Items reference `meal_item_id` (to keep or edit grams), or `{source: "catalog", food_id}` (to add one).
- Kept items reuse **their own stored per-100 g snapshot**, so an AI-estimate item stays editable after its scan expires. Changing the food → catalog values.
- The same checks 7–10 and the same basis/range rules apply.
- The day's target snapshot is not touched (§4).

### 2.6 Other boundaries

- **Every** user-owned query goes through a repository that requires `user_id` (enforced by a test that fails on any raw query against user tables).
- Free text from the model or the user (meal names, evidence, questions) is length-capped and stored and rendered as plain text only.
- **Server-side caps apply regardless of the client:** image size, pixel dimensions, item count, grams, and request rate. The UI's 3× portion confirmation is UX only, not a security control.

---

## 3. In-process scan job lifecycle (R2)

### 3.1 Runtime model

- **One Uvicorn worker process.** Each scan runs as an `asyncio` task, registered in an in-memory `JobRegistry {scan_id → task, image_bytes}`.
- Image bytes exist **only in process memory** and are released in `finally`. Because of that, a scan whose process died **cannot be resumed** and is failed as retryable. The phone still has the photo (A3 copy: "Your photo stays on this phone"), so a retry means uploading again.
- Concurrency: a semaphore allows `MAX_ACTIVE_ANALYSES = 2`, with up to 4 more scans `QUEUED`. If the queue is full → `503 busy` (retryable).
- Each process start generates a `boot_id` (UUID), recorded on every job it owns.

### 3.2 States and transitions

Every transition is a **conditional UPDATE** (compare-and-set) on `(id, status, attempt_token)`. Whichever of cancel, reaper, timeout, or completion arrives first wins, and the others become no-ops.

```
POST /scans ──▶ QUEUED ──(semaphore acquired)──▶ ANALYZING ──(valid result)──▶ READY ──(meal saved)──▶ SAVED
                  │                                   │                          │
                  │ DELETE                            │ DELETE                   │ 24 h TTL
                  ▼                                   ▼                          ▼
              CANCELLED ◀─────────────────────── CANCELLED                    EXPIRED (analysis_json purged)
                  ▲                                   │
                  └──── DELETE (READY) ───────────────┤ failure
                                                      ▼
                              FAILED(reason ∈ no_food | schema_invalid | provider_error |
                                             timeout | interrupted | budget_exhausted | refused)
```

| Event | Rule |
|---|---|
| **Create** | Authenticate → check daily limit (§6) → **reserve budget** (§6) → validate image → insert `QUEUED` with `deadline_at = now + 60 s` and `boot_id` → register task → `202`. |
| **Idempotent create** | Same user + `Idempotency-Key` already exists → return that scan and do **not** call the provider again. A user retry after a failure must use a new key. |
| **Start** | `QUEUED → ANALYZING` when the semaphore is acquired; sets `attempt_token`, `heartbeat_at`, and `stage = identifying`. |
| **Heartbeat** | The task updates `heartbeat_at` every 5 s and at each stage change (`identifying → matching`). |
| **Timeouts** | Provider: connect 5 s, read 30 s. Whole job: `deadline_at` (60 s from creation, queue wait included). The client offers "Keep waiting" at 20 s and stops polling at 75 s. |
| **Retry inside a job** | At most **2 provider calls per scan**, counting all retries. One retry is allowed only for: (a) 429 with `Retry-After ≤ 5 s`, 5xx, or connection reset; (b) output that fails schema validation (re-ask with the errors). Each retry needs ≥ 15 s left before the deadline. No retry for 4xx auth errors (raise an operator alert), content refusals, or `budget_exhausted`. |
| **Cancel** | `DELETE /scans/{id}`. `QUEUED` → `CANCELLED` immediately. `ANALYZING` → set `cancel_requested`, call `task.cancel()` (aborts the HTTP request), then compare-and-set to `CANCELLED`. A late result fails the compare-and-set and is dropped. Cost already incurred is still recorded. `READY` → `CANCELLED` and the analysis is purged. |
| **Reaper** (every 15 s) | `ANALYZING` with `heartbeat_at < now − 20 s`, or past `deadline_at` → `FAILED(timeout)`, and the in-memory task is cancelled if it is still present. |
| **Boot sweep** | On startup, before accepting requests: every `QUEUED`/`ANALYZING` row with `boot_id ≠ current` → `FAILED(interrupted)`, and its budget reservation is released down to the cost actually recorded. |
| **Graceful shutdown** (SIGTERM on deploy) | Stop accepting new scans (`503 busy`), wait up to 20 s for running jobs (Compose `stop_grace_period: 30s`), then mark the rest `FAILED(interrupted)`. |
| **Expiry** (hourly) | `READY`/`SAVED` older than 24 h → `analysis_json = NULL`; `READY` becomes `EXPIRED`. Scan and attempt metadata kept 90 days. |

### 3.3 Per-attempt accounting

Each provider call writes one `scan_attempts` row: n, start and end time, outcome, HTTP status, input and output tokens, cost estimate. This includes cancelled and failed calls, so budget and benchmark numbers reflect what was actually spent.

### 3.4 How failures map to the client

| Reason | Retryable | Design state |
|---|---|---|
| `no_food` | no | A2 "We couldn't find food in this photo" |
| `schema_invalid`, `provider_error`, `timeout`, `interrupted`, `refused` | yes (new scan, same photo) | A2 "Something went wrong on our side" → Try again |
| `budget_exhausted` | no (until reset) | A2 limit variant, **new copy needed** (D16) |
| `daily_scan_limit` (429 at create) | no | A2 "You've reached today's scan limit" |

Failed scans with a retryable reason **do not count** toward the user's daily limit. They **do count** toward budget, using actual cost.

---

## 4. Targets changed during a day; historical snapshots (R3)

D1 (the formulas) stays **open**. These rules are independent of the formulas.

### 4.1 Rules

| # | Rule |
|---|---|
| T1 | **A target change during a day applies to the whole current local day, immediately.** Daily totals are not time-of-day based, so splitting a day is meaningless. Home, Meal Fit, and today's history row all show the new target at once. (Confirm: D17.) |
| T2 | **Past days are frozen.** Once `local_date < today` in the user's current timezone, the day's target snapshot never changes, whatever later happens to targets, profile, formula version, or timezone. |
| T3 | **Each day's target is stored in `daily_target_snapshots`**, keyed `(user_id, local_date)`. It is not recomputed from revision history at read time. |
| T4 | **When a snapshot is created:** (a) when a target revision becomes active, today's snapshot is upserted; (b) when a meal is saved, or a day is read, for a date with no snapshot, the snapshot is resolved from revision history as of the end of that local date (in the meal's timezone) and inserted. Rule T2 applies from then on. |
| T5 | **Today's snapshot may only be updated by T4(a)**, i.e. by a new active revision. Several changes in one day → the last one wins for today, and every revision is kept in `target_revisions`. |
| T6 | **Recommendation changes are proposals.** A profile edit or a formula-version upgrade writes a `target_proposals` row (one pending per user) and changes nothing that is active. If `active_source = recommended`, U2 asks "Apply new recommendation?". If manual, U2 shows the change notice and the manual target stays (✅ approved rule). Accepting creates a new `target_revisions` row and, through T4(a), updates today's snapshot. Dismissing marks the proposal dismissed. |
| T7 | **Clearing the manual target** creates a revision with `active_source = recommended`, using the latest accepted recommended values. |
| T8 | **Editing or deleting a meal on a past day** uses that day's frozen snapshot. Totals are recomputed from the day's meals, but the snapshot is not changed. |
| T9 | **Timezone change (travel):** new meals get their own `local_date` from their `eaten_at` and `timezone`. Existing snapshots and meals are never re-bucketed. |
| T10 | **Under-18 / ineligible:** the recommended block is NULL; snapshots carry only manual values. If neither exists, the snapshot is "no target", and Home shows totals without remaining-kcal. |

### 4.2 Read path

`GET /days/{local_date}` → that day's meals + the snapshot, created first if missing (T4b). The response includes `target.source`, `target.formula_version`, and `target.changed_today: bool`, which lets Home show an optional "Target updated today" note.

---

## 5. Extensible analysis pipeline (R4)

The one-call strategy stays the **MVP default**. The structure allows extra steps if the benchmark justifies them.

```python
class VisionProvider(Protocol):          # one adapter per vendor
    name: str
    async def analyze(self, image: PreparedImage, ctx: AnalysisContext) -> ProviderResult: ...
        # ProviderResult = validated VisionAnalysisV1 + usage(tokens, cost) + raw_ref

class AnalysisStep(Protocol):            # pipeline unit
    name: str
    async def run(self, state: AnalysisState, ctx: StepContext) -> AnalysisState: ...
        # StepContext exposes: provider registry, catalog, budget.reserve(), call counter

PIPELINES = {
  "default.v1": ["vision_primary", "catalog_match", "validate_nutrition", "score_uncertainty"],
  # candidates, NOT built in MVP:
  # "disambiguate.v1": [... "catalog_match", "llm_candidate_pick", ...]   text-only top-5 choice
  # "two_pass.v1":     ["vision_primary", "vision_portion_pass", ...]      second image call
}
```

- **Pipeline selection** is config (`ANALYSIS_PIPELINE=default.v1`), recorded per scan (`pipeline_version`) along with `provider`, `model`, `prompt_version`, `schema_version`.
- **The call cap and the budget are enforced in `StepContext`**, not inside individual steps, so a new step cannot bypass cost control. `MAX_PROVIDER_CALLS_PER_SCAN` defaults to 2.
- **Contracts are separate:** `vision.v1` is the model-facing schema, `ScanResult` is the client-facing API. New steps add fields to the internal `AnalysisState` only; the API is unchanged unless a new feature is deliberately exposed.
- **Server-side refinement is reserved, not built:** `POST /scans/{id}/refinements` (returns `501` in the MVP). The scan carries `analysis_revision` (starts at 1), and the save payload must quote it (§2.3 check 5). A future refinement increments the revision, which invalidates stale client drafts instead of mixing two analyses.
- **Provider adapters** handle image encoding, structured-output mode, usage/cost extraction, and error normalization into `provider_error | timeout | refused | schema_invalid`. They are tested with **recorded responses** (no live calls in CI).

---

## 6. Hard cost control (replaces v1.1 §7.3)

| Layer | Control | Default |
|---|---|---|
| 1 | **Provider-side hard spend cap** on a CaloSnap-only API key/project (separate from StockPulse's) | Set after benchmark (D5) |
| 2 | **App monthly ceiling with reservation:** before each provider call, reserve `est_cost_max`. When the call ends, settle to actual cost. If `spent + reserved + est > ceiling` → `budget_exhausted`. This prevents concurrent scans from overshooting. | Ceiling after benchmark; warning log at 80 % |
| 3 | **Per-user daily scan limit** (successful + `no_food` scans count) | Number after benchmark (proposed 20–30) |
| 4 | **Per-scan caps:** ≤ 2 provider calls; output token cap; image ≤ 1600 px long edge (bounds input tokens) | As listed |
| 5 | **Concurrency cap:** 2 active, 4 queued | As listed |
| 6 | **Kill switch:** `SCANS_ENABLED=false` → new scans return `503` with the budget copy; diary features keep working | Off by default |

`est_cost_max` is computed from the measured maximum token usage at the configured caps × the vendor's price, read from the vendor's price page when the config is written and stored in config with its date.

---

## 7. Early Vision AI feasibility benchmark (R5)

**Runs as Phase 1B, in parallel with the UI prototype (1A).** Its result feeds Gate B (the provider choice) before Phase 3.

### 7.1 Dataset (≥ 45 meals; ~100 photos)

| Group | n | Purpose |
|---|---|---|
| Vietnamese mixed dishes (e.g. cơm tấm, phở, bún chả, bún bò, bánh mì, cơm gà, xôi, gỏi cuốn, mì xào, cá kho + rice, rau muống xào) | 15 | Component breakdown + match rate on local foods |
| Other mixed dishes (pasta, salad with dressing, burger + fries, curry + rice) | 8 | General mixed-dish baseline |
| **Hidden oil/sauce series:** the same dish cooked with 0 / 1 / 2 tbsp oil, or with dressing measured | 8 | Hidden-fat detection, and whether the oil question helps |
| **Portion series:** the same food at 3 weighed portion sizes, in 2 container types | 6 | Portion estimation error |
| Single-item controls (banana, boiled egg, plain rice bowl, bread) | 4 | Floor for the error |
| Edge cases (empty plate, menu/text photo, blurry, packaged food, non-food) | 4+ | `is_food`, quality flags, refusal handling |

**Ground truth:**
- Each component weighed on a kitchen scale (±1 g) before assembly; oil and sauce measured by volume and weight; recipe recorded.
- Reference kcal computed with **the same catalog** the app uses, which separates recognition and portion error from database error.

**Photos:**
- Phone camera, top-down + 45°, normal light; plus one low-light shot per 5 meals.
- No faces or personal items in frame.

**Who produces the dataset** (cooking and weighing) is a resourcing decision (D18).

### 7.2 Protocol

- 2–3 candidate models across ≥ 2 vendors, including one lower-cost tier. Candidates are named at benchmark start, after the retention/training-terms check (D2).
- Same `vision.v1` prompt and schema; each image run **3×** to measure variance.
- A standalone harness in `benchmark/`: validates with the production Pydantic schema, records raw responses, usage, and latency, and runs the prototype catalog matcher on an FDC import.
- **Question usefulness test:** apply the option that matches ground truth for each question, then measure the error reduction.

### 7.3 Metrics and proposed Gate B thresholds (D15: PO to confirm)

| Metric | Proposed go threshold |
|---|---|
| Schema-valid rate (after ≤ 1 retry) | ≥ 98 % |
| `is_food` correct on edge set | ≥ 95 % |
| Component recall (human-judged) on mixed dishes | ≥ 80 % |
| Catalog top-1 match correct | ≥ 75 % (rest: AI estimate or user change) |
| Meal kcal median absolute % error, mixed dishes (Auto) | ≤ 30 % (report MAE and P90 too) |
| Ground-truth kcal inside [low, high] | 60–90 % (below = overconfident; above = range too wide to be useful) |
| Hidden-oil detection (oil item present when oil ≥ 1 tbsp) | ≥ 70 % |
| Precision answer reduces error (median) | Reported; no threshold for MVP |
| Latency p95 (Analyze → result, server side) | ≤ 15 s |
| Cost per scan (incl. retries) | Reported → sets D5 |

**If no candidate passes:** options for the PO are (a) switch on a §5 step such as `llm_candidate_pick`, (b) narrow the MVP promise (single plates first), or (c) change the model or vendor. **No accuracy claim is published** beyond the measured figures (v1.1 §3).

### 7.4 Outputs

Benchmark report (one page + tables); raw results CSV; per-meal **matching failure log** (feeds §8); recommended `est_cost_max`, daily limit, and monthly ceiling.

---

## 8. Curated food catalog: start small, grow from measured failures (R6)

- **Seed ≤ 40 curated entries**, added only when no adequate FDC Foundation/SR Legacy generic exists for a component that is common in the benchmark set (typical: specific Vietnamese composites or local preparations). **Aliases are preferred over new entries**: Vietnamese and English synonyms point to existing FDC rows.
- **Each curated entry requires:** a source (reference URL or a documented recipe calculation), a curator, a date, and a reason. Entries are never edited in place; corrections add a new row and set `retired_at` on the old one, so meal snapshots stay traceable.
- **Measured-failure loop:**
  1. A `match_events` row per scan item: query, top candidates and scores, match decision.
  2. At save, the server records whether the user **changed the food** (and to what) or removed the item.
  3. A monthly review (CLI report) ranks unmatched items, low-score matches, and frequent user overrides.
  4. For each top failure: add an alias → adjust ranking/category → add a curated entry (in that order).
- **Metrics tracked:** top-1 match rate, AI-estimate share of kcal, "change food" rate per food.
- **Privacy:** match events store food names and scores only, never images or free-text user notes.

---

## 9. Private deployment connectivity: Tailscale-only vs Caddy + HTTPS (R7)

### 9.1 Comparison

| Dimension | **A. Tailscale-only** (container sidecar + Tailscale Serve) | **B. Caddy + public HTTPS** |
|---|---|---|
| Internet exposure | **None.** API reachable only from tailnet devices; Droplet keeps zero inbound ports (same as StockPulse today) | Ports 80/443 open to the world; bots will probe |
| Cost-abuse risk (top risk) | Very low: an attacker must first join the tailnet | Relies on app auth + rate limits + budget caps |
| Auth layers | Tailnet device identity + invite-code token | Invite-code token only |
| TLS | WireGuard end-to-end, plus Tailscale Serve HTTPS with a `*.ts.net` certificate. **Satisfies iOS ATS / Android cleartext rules with no exceptions** | Let's Encrypt via Caddy |
| Droplet changes | **None at host level.** `tailscale/tailscale` container in the `calosnap` project, userspace networking (no `/dev/net/tun`, no `NET_ADMIN`), outbound only | Domain/DNS; open 80/443 in the DO Cloud Firewall (infrastructure change); confirm ports free |
| Third parties | Tailscale coordination server sees device metadata, not traffic | Let's Encrypt; DNS provider |
| Phone usability | Tailscale app must be installed and **connected**. iOS allows one active VPN at a time (conflicts with work VPNs). On-demand/always-on settings reduce friction. Small battery cost | Works on any network with no extra app |
| Tester onboarding | Each tester needs a Tailscale login and tailnet approval (or device sharing); check current free-plan user limits | Invite code only |
| Failure mode | VPN off → the server is unreachable while the phone is online. **This needs its own error state and copy** (D16): "Can't reach CaloSnap. Check that Tailscale is connected." | Standard online/offline |
| Dev workflow (Expo) | Laptop + phone on the tailnet; the same URL works everywhere | Same |
| Migration | Switching later only needs a new `API_BASE_URL` (build-time config) and adding the Caddy service | — |

### 9.2 Recommendation (🟦, D7)

**Option A, Tailscale-only, for the private MVP** with ≤ 3–5 known testers. It removes the biggest risk (public paid endpoint), needs no inbound ports or host changes on the shared Droplet, and keeps CaloSnap isolated from StockPulse. Invite-code auth stays on as defense in depth.

**Move to B** if the testers grow beyond what's practical on a tailnet, or before any wider beta. The API base URL is a build-time setting from day one, so the switch costs one config change and one service.

Mobile requirements that come from A:
- A distinct "server unreachable" state: the device is online but the API can't be reached. It is not the same as A3 offline.
- Copy pointing to Tailscale.
- A connectivity check on app start (`GET /health` with a short timeout).

---

## 10. StockPulse isolation rules (R8; replaces v1.1 §8.2)

1. No reading, editing, copying, or printing of any StockPulse file that holds secrets (`.env`, tokens, DB contents). v1.1 read only `docker-compose.yml`, `Dockerfile`, and `DEPLOY.md`. **No further StockPulse file access is planned.**
2. No stopping, restarting, rebuilding, or updating of StockPulse containers, and no changes to its directory, ports, volumes, network, or schedules.
3. **No host-level infrastructure changes** (packages, firewall, swap, Droplet resize, DO firewall) in any phase without a separate written approval. Option A (§9) is chosen partly because it needs none.
4. **The Phase 6 audit is run by the PO, or with explicit approval**, using only commands that cannot print secrets:
   - `free -h`, `df -h`, `swapon --show`, `ss -tlnp`;
   - `docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'`;
   - `docker stats --no-stream`.
   **Explicitly excluded:** `docker inspect` (shows env vars), `docker compose config` (expands `.env`), `env`, `printenv`, and `cat` of any `.env` file.
5. CaloSnap runbook commands always use `-p calosnap` and only `/opt/calosnap`. `prune`, `down -v`, and image cleanup across projects are forbidden.
6. Container caps (`mem_limit`, `cpus`), log rotation, and the build-off-box rule (v1.1 §8.3–8.4) stand.

---

## 11. Schema delta (extends v1.1 §5)

```sql
-- scans: add
  analysis_revision INT NOT NULL DEFAULT 1,
  pipeline_version TEXT, boot_id TEXT, attempt_token TEXT,
  heartbeat_at, deadline_at, cancel_requested INT DEFAULT 0,
  budget_reserved_usd REAL DEFAULT 0
  -- status CHECK adds 'QUEUED'; failure_reason CHECK per §3.2

scan_attempts    (id PK, scan_id FK, n INT, started_at, ended_at, outcome,
                  http_status NULL, input_tokens, output_tokens, cost_usd_estimate REAL)

match_events     (id PK, scan_id FK, item_ref, query TEXT, category,
                  candidates JSON,               -- [{food_id, score}] top 5
                  matched_food_id NULL, score REAL, decision CHECK(IN('matched','ai_estimate','unavailable')),
                  user_outcome NULL CHECK(IN('kept','changed','removed')), user_food_id NULL,
                  created_at)

daily_target_snapshots (user_id FK, local_date DATE, target_revision_id FK NULL,
                  kcal NULL, protein_g NULL, carbs_g NULL, fat_g NULL,
                  source CHECK(IN('recommended','manual','none')), formula_version NULL,
                  created_at, updated_at,
                  PRIMARY KEY(user_id, local_date))

target_proposals (id PK, user_id FK, kcal, protein_g, carbs_g, fat_g, formula_version,
                  inputs_snapshot JSON, reason CHECK(IN('profile_change','formula_upgrade')),
                  status CHECK(IN('pending','accepted','dismissed')), created_at, resolved_at NULL)
  -- partial unique index: one 'pending' per user

budget_ledger    (month TEXT PK, ceiling_usd REAL, spent_usd REAL, reserved_usd REAL, updated_at)

food_catalog: add  retired_at NULL, curator NULL, curated_reason NULL
meal_items:   add  scan_item_ref NULL, source CHECK(IN('scan_item','catalog'))
```

---

## 12. Decision register (replaces v1.1 §1.2)

| ID | Decision | Status |
|---|---|---|
| D1 | Nutrition-target formulas | **OPEN, separate review.** Engine stays a stub behind its interface; UI uses fixtures |
| D2 | Vision provider + model; retention/training terms | Open → decided at **Gate B** from the benchmark |
| D3 | Unmatched foods | **PO-provisional:** keep, labelled AI estimate, validated per §2.4 |
| D4 | Auth | **PO-provisional:** invite code → device token |
| D5 | Scan limit, monthly ceiling, provider cap | **PO-provisional strategy (§6)**; numbers set after the benchmark |
| D6 | Photo retention | **PO-provisional:** no permanent server-side storage. *Confirm:* History thumbnails stored on the device only, controlled by "Keep meal photos" (default off) |
| D7 | Connectivity | **Recommended:** Tailscale-only (§9). Awaiting PO choice |
| D8 | Release platforms (iOS needs a paid Apple Developer membership) | Open; needed before Phase 6 |
| D9 | Meal-type time defaults | Open (minor); proposed defaults used in Phase 1 mocks |
| D10 | Units / language | **PO-provisional:** metric, English UI |
| D11 | Detection overlays on A1 | **PO-provisional:** deferred |
| D12 | Meal Fit | **PO-provisional:** projected daily progress, no verdict labels |
| D13 | Droplet capacity | Open, after the PO-run audit (§10.4) |
| D14 | Icon library, O1 hero photo | Open (minor); placeholders in Phase 1 |
| D15 | Benchmark Gate B thresholds | **New**; proposed in §7.3 |
| D16 | New copy: `budget_exhausted`, "server unreachable" (Tailscale), `nutrition_unavailable`, `scan_expired` on save | **New**; draft copy provided in Phase 1 for PO edit |
| D17 | Target change applies to the whole current day (T1) | **New**; recommended |
| D18 | Who produces the benchmark dataset (cooking + weighing ~45 meals) and the timeline | **New** |

---

## 13. Remaining blockers

**To start Phase 1:**

1. **Approve v1.2**, specifically §2, §3, §4, §9 recommendation, §10, §11.
2. **D18:** who builds the benchmark dataset, and by when. This is on 1B's critical path.
3. **Benchmark vendor accounts:** CaloSnap-only API keys with provider spend caps for 2–3 candidates. **Not StockPulse's keys.** Retention/training terms reviewed before any photo is sent.
4. **D15:** confirm or adjust the Gate B thresholds.

**Not blocking Phase 1:**
- Before Phase 3: D2, D5 numbers.
- Before Phase 5: D1, D6 confirmation, D9, D17.
- Before Phase 6: D7, D8, D13, D14.
- D16 copy is drafted during Phase 1.

---

## 14. Phase 1 implementation checklist (for approval; nothing is installed or written until approved)

### 14.0 Repository setup

- [ ] Layout: `mobile/` (Expo app), `shared/fixtures/` (calculator + contract fixtures), `benchmark/` (1B harness), `docs/design/` (copy of `design_handoff_calosnap_mvp/` per handoff §13), `specs/`. `backend/` is created in Phase 2.
- [ ] `.gitignore` (env files, benchmark photos, raw outputs), `README.md`, `CONTRIBUTING` notes on branch + approval gates.
- [ ] Packages to install **after approval** (exact versions pinned and recorded at install time):

  | Area | Packages |
  |---|---|
  | Core | `expo` (SDK version verified current-compatible), `typescript`, React Navigation 7 (native-stack, bottom-tabs) |
  | UI and device | `react-native-svg`, `react-native-reanimated`, `react-native-gesture-handler`, `@gorhom/bottom-sheet`, `expo-font` + Plus Jakarta Sans, `expo-camera`, `expo-image-picker`, `expo-image-manipulator`, `expo-file-system` |
  | Data and state | `@react-native-community/netinfo`, `@tanstack/react-query` + persister, `zustand` |
  | Tests and tooling | `jest-expo`, `@testing-library/react-native`, ESLint/Prettier |
  | Benchmark (1B) | Python 3.12 venv in `benchmark/`: `pydantic`, `httpx`, vendor SDKs for the candidates |

### 14.1 Phase 1A: Mobile UI prototype (mock data only)

**Foundation**
- [ ] `theme.ts` generated from `tokens.json`; a test checks that every token is mapped.
- [ ] Typed API contracts in `mobile/src/api/types.ts`, matching v1.1 §4.3 **as revised by v1.2 §2.2** (intent-only save payload, `analysis_revision`, error codes incl. `busy`, `budget_exhausted`, `analysis_stale`, `nutrition_unavailable`, `scan_expired`).
- [ ] `ApiClient` interface + `MockApiClient` with configurable latency and injectable outcomes: success Auto/Precision (0–3 questions), `no_food`, low confidence, `service_error`, `daily_scan_limit`, `budget_exhausted`, `nutrition_unavailable` item, server unreachable, offline, save error, save replay.

**Primitives** (Design §7)
- [ ] Button (4 variants + disabled), SegmentedControl, SelectableCard, InputTile, Stepper (long-press repeat), CalorieArc, MacroBar (+ projected/hatched), RangeScale, ConfidenceDots, BasisChip, IngredientRow, AnswerTile, ImpactChip, Card, MealCard, BottomSheet, Toast (live region), Banner, TabBar (raised Scan), camera controls.

**Screens by ID**
- [ ] O1–O6, O3b; H1–H3; S1–S3; A1–A3 (+ new "server unreachable" state); P1–P3; R1 (Auto/Precision badge, offline, saving, save error, saved-meal mode, `nutrition_unavailable` row); R2; D1, D2; U1, U2 (incl. proposal / change notice).
- [ ] Undrawn screens from Design §6: discard confirm, first-upload consent sheet, Add item / Change food search sheet, saved meal review.

**Logic**
- [ ] Navigation exactly as in Design §5.
- [ ] Draft reducer (v1.1 §4.1 client machine) with a transition table.
- [ ] TypeScript calculator + effect application (`set_grams`, `remove_item`, `add_item`, `set_cooking_method` as metadata only).
- [ ] Basis/range rules mirroring §2.3 derivation, so the preview matches the server.
- [ ] Day selectors read **only** persisted meals (mock store); Undo deletes; totals animate.
- [ ] Mock target snapshots implementing T1–T10 behavior for U2 and Home displays (engine values come from fixtures; **no formula code**, D1).
- [ ] Offline: NetInfo + persisted query cache; Analyze/Save disabled; read-only banner.
- [ ] Copy v1.1 verbatim; D16 draft copy marked `// COPY-PENDING` and listed for the PO.

**Shared fixtures**
- [ ] `shared/fixtures/calculator/*.json` (≥ 15 cases: rounding, zero-gram rejection, ranges, AI-estimate widening, user_set collapse, replay with answers/skips/adds/removes).
- [ ] `shared/fixtures/vision/*.json` (valid + invalid `vision.v1`).
- [ ] The same fixtures will drive the Python tests in Phase 2.

**Tests (exit criteria)**
- [ ] Unit:
  - reducer (every valid and invalid transition);
  - calculator fixtures; effects; range-scale end labels;
  - arc segments incl. over-target;
  - manual target validation (Design §10);
  - daily selectors reject draft input (type + runtime test);
  - payload builder emits **no nutrient fields**.
- [ ] Integration (RNTL):
  - S2 → A1 → R1 (Auto);
  - S2 → A1 → P1–P3 with skip, answer, and use-estimate → R1;
  - R1 → R2 edit/remove/change food → Save → Home totals change;
  - discard → totals unchanged;
  - save error keeps the draft;
  - offline disables Analyze/Save;
  - unreachable state;
  - under-18 → manual path.
- [ ] Accessibility: labels per Design §11; Dynamic Type 200 % layouts; Reduce Motion.

**QA checkpoint 1A**
- [ ] Screenshot set per screen ID on iOS simulator and Android emulator at 360/390/430 pt, compared side by side with `CaloSnap UI Design v1.1 (standalone).html`; differences listed.
- [ ] Screen-reader walkthrough of the core flow.
- [ ] Demo recording of Auto and Precision flows → PO review.

### 14.2 Phase 1B: Vision AI feasibility benchmark (parallel)

- [ ] `benchmark/PROTOCOL.md`: dataset table (§7.1), weighing and photo protocol, ground-truth sheet template (CSV: meal, component, grams, oil_ml, catalog food_id, photo files).
- [ ] Vendor terms check (retention, training, region) recorded per candidate **before** any upload.
- [ ] CaloSnap-only keys with spend caps; harness-level hard stop at a fixed benchmark budget.
- [ ] FDC Foundation + SR Legacy import prototype (reused in Phase 2) + prototype matcher (alias → FTS5 → threshold).
- [ ] Harness: images × models × 3 runs; production `vision.v1` Pydantic validation with ≤ 1 retry; raw responses, usage, latency stored locally (git-ignored).
- [ ] Scoring script: every §7.3 metric + question-usefulness replay.
- [ ] Matching failure log → candidate aliases / ≤ 40 curated entries (§8).
- [ ] **Gate B report:** metrics per model vs D15 thresholds, cost per scan, recommended D2 / D5 values, known failure patterns (with Vietnamese dishes and hidden-oil cases called out separately).

**Tests:** harness unit tests for scoring math (MAE, median APE, range coverage) on synthetic data; schema validation tests shared with `shared/fixtures/vision/`.

### 14.3 Phase 1 exit gate

- [ ] 1A QA checkpoint passed and the PO approves the UI.
- [ ] 1B Gate B report delivered and the PO decides D2 and D5.
- [ ] Every open item in §12 updated.
- [ ] No backend production code, no deployment, no StockPulse access during Phase 1.
