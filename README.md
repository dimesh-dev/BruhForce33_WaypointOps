# Waypoint · Delivery planning for Waypoint Group

Tech-Triathlon 2026 · **Hackathon build**. One system that connects ordering, planning, loading, delivery and receipt for Waypoint Group's four roles, built from our Day 5 Designathon design.

- **Dispatcher**: closes the order queue, generates a constraint-checked allocation for a day when demand exceeds capacity, edits it with validation, publishes it, follows trips live, resolves issues and plans future capacity.
- **Loader** (phone or dock tablet): loads each vehicle in reverse stop order, reports shortfalls that hold the vehicle, releases it.
- **Driver** (phone): starts the trip, records each stop with receiver, quantity, photo and signature, works offline and syncs when coverage returns.
- **Store manager**: places orders before the 16:00 cutoff, sees the vehicle and arrival time or the deferral reason, confirms what arrived or reports a problem.

Stack: Next.js 16 (App Router, route handlers), React 19, TypeScript, PostgreSQL 16, Tailwind 4 + the Designathon stylesheet, Playwright. No external services or API keys.

> **Deployed URL:** https://waypoint-tech-triathlon.vercel.app (accounts below, password `waypoint2026`) · **Demo video:** `[add YouTube link]`

## Quick start

```bash
cp .env.example .env          # optional; defaults work for a local run
docker compose up --build
```

Open http://localhost:3000. The first start creates the schema, loads the datasets in `data/` and seeds the walkthrough day. Restarting keeps your data; the dispatcher's **Reset demo** button (or `docker compose down -v`) restores the seeded day.

### Without Docker

Requires Node.js 22.18+ and PostgreSQL 14+.

```bash
npm install
createdb waypoint
echo 'DATABASE_URL=postgres://localhost/waypoint' > .env.local
npm run db:setup      # schema + seed (npm run db:reset to start over)
npm run dev           # http://localhost:3000
```

### Deploy on Vercel

1. Add a PostgreSQL database: Vercel project → **Storage** → **Create / Connect Database** → **Neon** (Postgres). Connect it to the project; Vercel adds `DATABASE_URL`.
2. Project → **Settings → Environment Variables** (Production): `SESSION_SECRET` (long random string, e.g. `openssl rand -hex 32`), `COOKIE_SECURE=true`, `DB_POOL_MAX=3`, and optionally `DEMO_PASSWORD`, `DEMO_RUN_DATE`, `DEMO_START`, `ALLOW_RESET`, `SHOW_DEMO_ACCOUNTS`.
3. Seed the database once from your machine with the same connection string: `DATABASE_URL='<neon url>' npm run db:setup`. (Vercel does not run the Docker start command.)
4. Redeploy. Check `https://<your-app>.vercel.app/api/health` returns `"seeded_at"`, then sign in as `dispatcher`. **Reset demo** reseeds the database from the deployed app.

## Seeded accounts

All accounts use the password **`waypoint2026`** (`DEMO_PASSWORD`). The sign-in page does not list accounts; set `SHOW_DEMO_ACCOUNTS=true` for one-click sign-in during a local demo.

| Role | Username | Scope |
| --- | --- | --- |
| Dispatcher | `dispatcher` | Amaya Jayasinghe · all depots |
| Loader | `loader` | Ruwan Kumara · Peliyagoda dock (`loader.kandy` for Kandy) |
| Driver | `driver` | Kasun Perera · VEH001, first available Peliyagoda reefer truck |
| Store manager | `store` | Anjali Fernando · an outlet on VEH001's first trip (OUT043 · Fresh · Kalutara 04) |

Every vehicle also has a driver login named after it (`veh002` … `veh060`) and every outlet a manager login (`out001` … `out120`), so any order can be followed end to end.

## Seeded scenario

- **Run:** Tuesday 7 April 2026 (`DEMO_RUN_DATE`) from both depots, six days before Sinhala and Tamil New Year, so the calendar's festival build-up is lifting demand. 138 orders from 88 outlets: Fresh dry and chilled (55 chilled), Style's weekly delivery, Tech as-needed.
- **Scenario clock:** starts at Monday 6 April 14:30 Colombo time when the data is seeded, then runs in real time (`DEMO_START`; shown in the header). Orders placed before 16:00 join Tuesday's run; later ones, or orders after the dispatcher closes the queue, join Wednesday's.
- **Capacity pressure:** two Peliyagoda reefer trucks (VEH006, VEH007) and one dry truck (VEH034) are in the workshop, several vehicles have used 80-90% of their weekly fuel quota on Monday, and three outlets carry orders deferred on Monday. Refrigerated and van capacity bind: the engine serves about 89% and defers about 15 orders, each with a reason.

## Judge walkthrough

Follow one order from the store to receipt. Use a desktop window for the dispatcher and a phone-sized window (or a phone) for the loader, driver and store. Exact counts may vary by one or two orders if you place extra orders.

1. **Store manager places an order.** Sign in as `store`. The right panel shows the next run and its cutoff. Choose **Place a new order** → *Chilled & frozen* → **Place order**. The order number and its run date appear immediately (*Confirm before the cutoff*). The two seeded orders for this outlet show *Confirmed*.
2. **Dispatcher reviews the queue.** Sign in as `dispatcher` (new window). **Overview** shows the run, reefers available (14/16), the run progress steps and the three outlets skipped on Monday. **Orders** lists every queued order, including the store's new one; filter, search or export CSV.
3. **Close orders and generate the plan.** **Dispatch planner** → **Close queue** → **Generate plan**. Review the summary (service rate, deferred count, trips, fuel), *What limited service on this run* (refrigerated capacity), the **Deferred orders** table (reason, unavoidable vs dispatcher choice, next run) and the **Vehicles & trips** cards (Fresh 270-minute budget, weight and volume against both limits, depart/return times, fuel; expand a trip to see stops sequenced by window with arrival times).
4. **Try a change that breaks a rule.** On any chilled stop choose **Change** → pick a vehicle marked *⚠ not refrigerated* → **Validate & apply**. The change is rejected with `R2 … is chilled; … is not refrigerated`. Then defer an order with a reason, or use **Try to serve** on a deferred one; valid changes apply and the summary updates.
5. **Publish.** **Publish v1**. Loaders, drivers and stores are notified (bell icon). The store's orders now show vehicle, stop number and expected arrival; deferred orders show the reason and next run.
6. **Loader loads and flags a shortfall.** Sign in as `loader` (phone width). Open **VEH001 · trip 1**. The list is in reverse stop order (*load first* → *load last*). Choose **Report a shortfall**, pick an order and describe it: the vehicle is held (*Shortfall*) and **Mark ready** is disabled.
7. **Dispatcher decides.** As dispatcher, **Issues** → **Decide** → note → **Release vehicle as loaded** (or **Remove order from trip & defer**, which moves it to Wednesday and tells the store).
8. **Loader releases the vehicle.** Refresh, check each load, **Mark ready to depart**. The dispatcher overview shows the trip *Ready*.
9. **Driver delivers, including offline.** Sign in as `driver` on a phone. **Start trip**. At the first stop tap **Work offline** (or turn on airplane mode), then **Record delivery & proof**: receiver, units, optional photo and signature → **Save proof on this phone**. The banner shows *1 record waiting to sync*; reload the page and the record and route are still there. **Reconnect & sync** (or restore the network): the record is sent and the dispatcher's live board updates.
10. **Complete the stops.** Record the remaining stops online. The store's outlet is one of them (stop 3 of VEH001's first trip, to Kalutara). Try **Could not deliver** or **Report a delivery issue** on any stop to see them reach the dispatcher and store.
11. **Store confirms receipt.** As `store`, the delivered order shows the driver's record (units, receiver, photo/signature on record). **Confirm what arrived** → *Complete* (or *Short delivery*, which opens an issue for the dispatcher). The order moves to *Received*.
12. **Plan future capacity.** As dispatcher, **Capacity** shows the next eight weeks of demand per brand, chilled volume, vehicle trips needed and peak-day reefer trips against the reefer fleet, with paydays and festival build-up (Sinhala and Tamil New Year, Vesak, Poson). **Fleet & drivers** shows each vehicle's weekly fuel use and lets you send a vehicle to or from the workshop before regenerating.

**Offline conflict (optional):** sign in as `driver` in two browsers, take one offline, record a different quantity for the same stop in each, then sync. The second record does not overwrite the first; the dispatcher gets a *Sync conflict* issue showing both proofs.

**Reset:** dispatcher → **Reset demo** restores the seeded day for the next run-through.

## Datasets

`data/` holds the official shared reference files (General Data) with the booklet's filenames and columns: `outlets.csv` (120 outlets: 80 Fresh, 25 Style, 15 Tech), `vehicles.csv` (60 vehicles: 12 reefer trucks, 40 dry trucks, 8 vans of which 4 are refrigerated), `calendar.csv` (1 Jan 2024 – 28 Jun 2026), `district_travel.csv` (12 districts, two depots) and `service_allowance.csv`. The seed loads them as-is; the walkthrough day's orders are generated from these outlets and the calendar, so the scenario date must fall inside the calendar. Outlet names are derived from brand and district because the file has no name column. Adding `deliveries_train.csv` from the Training Data makes the capacity outlook use real order history. The shared datasets are confidential under the competition terms, so keep this repository private (share it with the judges) rather than public.

## Tests and checks

```bash
npm run typecheck
npm test                                            # planning engine: every rule, booklet trip-time examples, solver behaviour
E2E_BASE_URL=http://localhost:3000 npm run test:e2e # four-role walkthrough against a running, seeded stack
npm run build
```

The end-to-end test resets the data, then runs the walkthrough above: store order, close and plan, rejected manual edit (R2), publish, shortfall and release, offline delivery that survives a reload, sync, idempotent replay and conflict handling, remaining deliveries and store receipt, plus role isolation (403/401) and, against a production build, a full offline reload served by the service worker. First run: `npx playwright install chromium`.

## Repository layout

```
src/app/                  pages (/, /login) and API route handlers (src/app/api)
src/components/app/       role screens: dispatcher, planner, tables, capacity, issues, loader, driver, store
src/lib/planning/         pure planning engine (shared by API, seed and tests)
src/lib/client/           API hook, formatting, IndexedDB outbox, shared UI
src/server/               schema, seed, auth, planning, operations, sync, views, forecast
public/sw.js              service worker (offline app shell and last-known data)
data/                     shared dataset CSVs
docs/                     architecture, data model, AI disclosure, diagrams/ (PNG exports)
scripts/                  db-setup.ts, plan-preview.ts
tests/                    engine.spec.ts, e2e.spec.ts
```

## Configuration

See `.env.example`. Key variables: `DATABASE_URL`, `SESSION_SECRET` (required in production), `COOKIE_SECURE`, `DEMO_PASSWORD`, `DEMO_RUN_DATE`, `DEMO_START` (`off` for the real clock), `ALLOW_RESET`, `SHOW_DEMO_ACCOUNTS`, `DATA_DIR`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): component and sequence diagrams, planning engine, offline sync and recovery, security.
- [Data model](docs/DATA-MODEL.md): entity-relationship diagram and how records connect.
- [AI tool disclosure](docs/AI-DISCLOSURE.md).

## Departures from the Designathon submission

The build keeps the Day 5 flows, screens, copy and visual system (palette, Fraunces/DM Sans type, pencil-and-watercolour illustrations, cards, badges, connectivity banner, reverse-load list, delivery timeline). These changes were made while turning the prototype into a working system:

| Day 5 design | Hackathon build | Why |
| --- | --- | --- |
| Role switcher and store picker for reviewers | Real accounts per role, vehicle and outlet; server-side authorisation | Each role must only see and change its own work. |
| Six illustrative orders and three routes | All 120 outlets, 60 vehicles and a 138-order day built on the shared datasets | Brief requires seeded shared data and a realistic day. |
| "Build dispatch plan" review with representative route cards; tradeoff favoured manual judgment over automatic allocation | Engine proposes a complete allocation and explains every deferral; dispatcher edits are validated against all rules | The design's stated next step ("the allocator should propose feasible options; the dispatcher should understand why"). Explainability is kept: binding constraints, reason codes, unavoidable vs chosen. |
| Mall-window exception workspace for one order | Generalised: window check (W) on every stop, deferred-orders table and per-order change dialog | Same decision, applied to every order. |
| Schematic network map with illustrative positions | Live trip board (progress per stop, status) | The map positions were not real; the board shows real progress. |
| Insights page with illustrative charts | Capacity page: calendar-adjusted weekly outlook, trips and reefer trips vs fleet | Supports "plan future capacity" with real data. |
| Proof note standing in for photo and signature | Receiver, units, camera photo and signature pad, stored offline | Specified as later-build work on Day 5. |
| "Simulate offline" with localStorage | Service worker + IndexedDB outbox, idempotent sync, conflicts kept for review | Day 5 failure scenario B, built for real; the simulate control remains for demos. |
| Loader readiness was not a safety gate | Shortfall blocks release until the dispatcher decides | Day 5 noted this as production behaviour. |
| — | Issues inbox, fleet workshop toggle and weekly fuel view, demo reset | Needed to operate and demonstrate the workflow. |
| Guided tour | Numbered walkthrough above | Judges follow the README. |

## Submission checklist (team)

- [x] Official shared datasets (General Data) loaded from `data/`.
- [x] Rename the repository to `TeamName_SolutionName` (GitHub monorepo).
- [x] Deploy (Vercel + Neon Postgres): https://waypoint-tech-triathlon.vercel.app
- [ ] Record the 5-8 minute unlisted demo video and add the link.
- [ ] Submit repository link, URL, credentials and video before Sunday 4 October 2026, 23:59 Sri Lanka time.
