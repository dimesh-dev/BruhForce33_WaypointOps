# AI tool disclosure · Hackathon phase

Waypoint is a team-directed project developed with AI assistance. The team directed and approved the Designathon personas, workflows, failure scenarios and visual system that form the basis of this build. During the Hackathon phase, AI tools supported implementation, testing and documentation against the challenge brief and that existing design.

AI assistance was substantial, including code generation. The team remains responsible for the submitted solution, its design choices and the accuracy of this disclosure.

> **Before submission:** complete the bracketed review details below so this disclosure reflects the team's actual contributions and checks.

## Team contribution and ownership

- **Product and experience direction.** The team directed and approved the personas, role-based flows, failure scenarios and visual system during the Designathon. These decisions provided the foundation for the dispatcher, loader, driver and store-manager experiences.
- **Project context and implementation brief.** The team supplied the challenge booklet and existing Designathon repository, and asked the tools to identify Hackathon requirement gaps and implement the missing functionality within that context.
- **Continuity between design and implementation.** The Hackathon work builds on the team's approved design, carrying its workflows and visual language into the working application.
- **Review and refinement.** [Add specific examples of team feedback, implementation decisions, changes made by team members and AI suggestions that were revised or rejected.]
- **Acceptance and submission.** Final acceptance of the implementation and submission materials is the team's responsibility. [Record the manual checks completed by team members, including devices used and any remaining limitations.]

## Tools used

| Tool | Used for |
| --- | --- |
| Claude Code (Anthropic, Claude Opus 5.5) | Assisted with requirement-gap analysis, architecture proposals and substantial code generation for the backend, database schema, planning engine, offline sync, role screens, tests, Docker setup and documentation, using the supplied brief and team-approved design. |
| Google Antigravity / Gemini (per the earlier team disclosure) | An earlier backend iteration on `main` (JSON-file store, email-only sign-in, API routes, first allocation engine, IndexedDB helpers). Reviewed and superseded by this build; see below. |
| Codex (OpenAI) | Assisted with the original Designathon clickable prototype, design book and illustrations; during the Hackathon, also helped organise commits, correct tooling paths and refine this disclosure. |
| Built-in image generation | Designathon phase only: the pencil and watercolour illustrations reused in the app. |

## Scope of AI assistance

- **Architecture and implementation.** Working from the supplied brief and existing design, Claude Code proposed the architecture: a single Next.js app with route handlers, PostgreSQL, a pure planning engine and an IndexedDB outbox with idempotent server reconciliation. It generated substantial implementation code under `src/server`, `src/lib/planning`, `src/lib/client`, `src/components/app`, `src/app/api`, as well as `public/sw.js`, database and sample-data scripts, and Docker configuration.
- **Planning engine.** The challenge booklet (pages 5, 20–21) supplied the constraints. AI assistance covered the greedy best-fit algorithm, priority policy and deferral diagnosis. Gap analysis of the earlier backend iteration informed its replacement with database persistence, password-based sessions, delivery-window and fuel checks, and dataset-backed screens. The earlier PWA manifest was retained.
- **Data.** While the official shared files were unavailable, AI generated schema-compatible stand-in CSVs for development. They have since been replaced by the official General Data files (`outlets.csv`, `vehicles.csv`, `calendar.csv`, `district_travel.csv`, `service_allowance.csv`); the walkthrough day and its orders are generated from those records by the seed script.
- **Automated verification.** AI tools generated the engine unit tests and end-to-end walkthrough test, and ran type checks, the production build, both test suites and visual checks at desktop and phone sizes. These tool-run checks are separate from the team's manual acceptance checks recorded above.
- **Documentation.** AI tools drafted the README, architecture notes, data model and disclosure. The team is responsible for confirming that the final text accurately describes the implementation and its own work.

## How the collaboration worked

The team supplied the problem context, approved design and implementation request; the tools supplied analysis, implementation proposals, generated code and automated checks. This distinction recognises the team's product direction while disclosing the extent of AI implementation assistance. Specific human review and refinement should be documented in the team contribution section above.

## AI use at runtime

AI tools were used during development. The application does not call AI models at runtime; planning uses deterministic code in `src/lib/planning/engine.ts`.
