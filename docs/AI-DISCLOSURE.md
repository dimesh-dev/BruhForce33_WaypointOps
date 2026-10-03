# AI tool disclosure · Hackathon phase

> **Team: review and complete the bracketed parts before submitting.** This file must describe what your team actually did; edit anything that is not accurate.

## Tools used

| Tool | Used for |
| --- | --- |
| Claude Code (Anthropic, Claude Opus 5.5) | Gap analysis of the Designathon prototype against the Hackathon brief; design and implementation of the backend, database schema, planning engine, offline sync, role screens, tests, Docker setup and documentation in this repository. |
| Google Antigravity / Gemini (per the earlier team disclosure) | An earlier backend iteration on `main` (JSON-file store, email-only sign-in, API routes, first allocation engine, IndexedDB helpers). Reviewed and superseded by this build; see below. |
| Codex (OpenAI) | Designathon phase only: the original clickable prototype, design book and illustrations. |
| Built-in image generation | Designathon phase only: the pencil and watercolour illustrations reused in the app. |

## AI-assisted work

- **Architecture and code.** Claude Code proposed the architecture (single Next.js app with route handlers, PostgreSQL, pure planning engine, IndexedDB outbox with idempotent server reconciliation) and wrote the code under `src/server`, `src/lib/planning`, `src/lib/client`, `src/components/app`, `src/app/api`, `public/sw.js`, `scripts/db-setup.ts`, `scripts/generate-sample-data.mjs`, the `Dockerfile` and `docker-compose.yml`.
- **Planning engine.** The constraint set was taken from the booklet (pages 5, 20-21); the greedy best-fit algorithm, priority policy and deferral diagnosis were written by the AI. An earlier iteration on `main` (allocation engine, JSON-file persistence, email-only sign-in, API routes) was reviewed against the brief and replaced: its engine did not check delivery windows or fuel quotas, the screens still ran on six illustrative orders in browser storage, sign-in had no password or session check, and `docker compose` had no database service. Its PWA manifest was kept.
- **Stand-in data.** The official shared CSVs were not in the repository when this phase was built, so the AI generated schema-compatible stand-ins in `data/` (same filenames, columns and network totals as the brief). They are synthetic and clearly labelled; [replace them with the official files before submission].
- **Tests and verification.** The engine unit tests and the end-to-end walkthrough test were AI-written. The AI ran type checks, the production build, both test suites, and visual checks of each role screen on desktop and phone sizes.
- **Documentation.** README, architecture, data model and this disclosure were drafted by the AI.

## Work not AI-assisted

- The Designathon design decisions (personas, flows, failure scenarios, visual system), which this build implements, were directed and approved by the team. 

## How we used the tools

- The team gave the AI the challenge booklet and the existing Designathon repository and asked it to check every Hackathon requirement and implement what was missing.
- [Describe how the team reviewed the AI's output: which parts were read line by line, what was changed, what was tested manually on real phones.]
- No proprietary API-based models are used at runtime. The application contains no AI features; all planning logic is deterministic code in `src/lib/planning/engine.ts`.
