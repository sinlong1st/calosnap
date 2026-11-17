# CaloSnap — project instructions

Private, camera-first mobile MVP that estimates calories/macros from a meal photo. See `README.md` for setup and status.

## Sources of truth
- Design: `docs/design/` (Design v1.1 handoff; `README.md`, `tokens.json`, standalone HTML). Visual fidelity to v1.1 is required.
- Architecture: `specs/CaloSnap_Architecture_Review_v1.2.md` (supersedes parts of v1.1; v1.1 still applies where not superseded).
- Mobile app: `mobile/` (Expo SDK 58, Expo Router, TypeScript). Also read `mobile/AGENTS.md`.

## Working rules
- Work in PO-approved checkpoints. Stop at the end of each checkpoint and wait for review.
- Phase 1A is **mock data only**: no production backend, no paid Vision AI calls, no deployment.
- Do not hardcode unapproved nutrition formulas (D1 is open). Targets come from fixtures behind interfaces.
- Keep API access behind the `ApiClient` interface (`mobile/src/api/client.ts`).
- Never touch StockPulse (`../stock-pulse`): no reading its secrets, no stopping services, no infra changes.
- Do not add dependencies or services without need; use `npx expo install` for Expo packages.
- Before finishing a checkpoint, run in `mobile/`: `npm run typecheck`, `npm run lint`, `npm test`.

## Git
- Commit at logical, working milestones, not after every file change.
- Short, natural, single-line messages (< 72 chars), imperative ("Add home dashboard", "Fix navigation state").
- No long bodies, emojis, or AI attribution trailers (unless the repo/tooling explicitly requires them).
- Never amend, squash, rebase, or force-push existing commits without approval.
- Never commit secrets, `.env` files, API keys, database files, or benchmark photos.
- Run relevant tests before committing; if tests fail, report it instead of calling the milestone done.
- At each checkpoint, report commit hashes and a short summary of changes.
- Do not push to a remote unless explicitly authorized.

## Documentation
- Keep the root `README.md` concise and current: setup, local development, tests, structure, actual feature status.
- Clearly distinguish mock features from real backend/API integrations.
- Add a safe `.env.example` when environment variables are introduced.
- Specs live in `specs/`; design references in `docs/design/`.
- Update docs only when behavior or setup actually changes.
