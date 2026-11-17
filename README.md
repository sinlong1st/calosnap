# CaloSnap

Private, camera-first mobile MVP: photograph a meal, get an estimated calorie/macro range, correct it, and save it to a daily diary only when you choose to.

**Status:** Phase 1A, Checkpoint 1 (app foundation). **Everything runs on mock data.** There is no backend, no AI provider, and no deployment yet.

## Repository layout

```
mobile/          Expo (SDK 58) + React Native + TypeScript app
  src/app/       Routes (Expo Router): (tabs)/index = Home, (tabs)/history, scan (modal), profile
  src/screens/   Screen implementations
  src/components/ Reusable UI built from the design tokens
  src/domain/    Types and pure logic (dates, formatting, totals, progress)
  src/api/       ApiClient interface + MockApiClient and fixtures
  src/theme/     tokens.json (copy of the design tokens) and theme.ts
specs/           Technical plan and architecture reviews (v1.2 is current)
docs/design/     Design v1.1 handoff (README, tokens, standalone HTML, source)
```

## Setup

Requires Node 22+ and npm.

```bash
cd mobile
npm install
npx expo start          # then press a (Android emulator), i (iOS simulator), or scan the QR code with Expo Go
```

No environment variables are needed yet.

## Checks

```bash
cd mobile
npm run typecheck       # tsc --noEmit
npm run lint            # expo lint (ESLint)
npm test                # Jest (jest-expo + React Native Testing Library)
npm run check           # all three
```

## Feature status

| Area | Status | Data |
|---|---|---|
| Design tokens, typography, core components | Done | — |
| Navigation: Home / Scan (modal) / History tabs, Profile | Done | — |
| Home dashboard (H1 empty day, H2 in progress, over target, no target) | Done | **Mock** |
| Scan flow: camera, preview, analysis, Precision questions | Checkpoint 2 (placeholder screen) | — |
| Results review, ingredient editing, Save to diary | Checkpoint 3 | — |
| Onboarding, goals and targets, History diary, Profile | Checkpoint 4 (placeholder screens) | — |
| Backend API, auth, food catalog | Phase 2 (not started) | — |
| Vision AI analysis | Phase 3 (not started; provider not chosen) | — |

### Mock data

- `MockApiClient` implements the `ApiClient` interface the real HTTP client will use later. Daily totals are always computed from **saved** meals only.
- Target values (2,050 kcal · P 165 · C 208 · F 62) are the design's mock persona. They are **fixtures, not formula output**: the target formulas (D1) are not approved yet.
- In development builds, **Profile → Developer · mock data** switches between datasets: day in progress, empty day, over target, new user, and no target.
