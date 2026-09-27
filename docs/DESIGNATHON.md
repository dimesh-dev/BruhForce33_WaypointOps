# Waypoint · Designathon design book

## 01 · Purpose and scope

**A clear view of every delivery. A better start to the day.** Waypoint replaces disconnected planning sheets, loading lists, phone updates and handwritten receipts with one understandable delivery record. The core design question is: when every order cannot be served, how can one team make a decision that the next team can act on?

The prototype prioritizes an explainable dispatcher decision, its dock handoff, an offline delivery record and a store acknowledgement. It is a high-fidelity interactive design artifact in Next.js, React, TypeScript and Tailwind CSS. It is not the Hackathon implementation: allocation, routing, forecasting, live telemetry, authentication and a backend are intentionally outside this phase.

The supplied challenge booklet establishes four working contexts and six important operational checks. It is source material for the design, not authorization to publish, contact anyone, or submit a competition entry. No submission has been made.

## 02 · Working assumptions and domain

- The fictional network has 120 outlets: 80 Fresh, 25 Style and 15 Tech. It has Peliyagoda and Kandy depots, 60 vehicles, 12 refrigerated trucks, 40 dry-box trucks and 8 vans. Four vans are refrigerated, giving 16 cold-chain vehicles in total.
- Weight and volume are separate limits. Chilled goods require refrigerated vehicles; ambient goods can use either type. Van-only access rules remain visible. A vehicle starts at its home depot, can make at most two daily trips, and has a weekly fuel quota.
- Fresh must arrive within its outlet window and before 8 AM. Mall access is a fixed window; a late estimate does not silently extend access. Operations run Monday through Saturday. Next-day orders close at 4 PM.
- Monday 28 September 2026 at 06:30 Asia/Colombo is a fixed **review scenario**. The late mall ETA is a planning warning about a future arrival. The role screens compress planning, loading, delivery and receipt stages to enable a judge to walk through the complete service journey.
- Shared CSVs were not supplied in the workspace. Six seed orders, three route cards, coordinates, ETAs, driver names and capacities are illustrative. WP-prefixed identifiers deliberately avoid claiming they are official OUT/VEH records. High-level network totals come from the booklet; dashboard performance and volume estimates are invented demonstration values.
- The current store manager is a demonstration persona. A store picker exposes another affected outlet so the judge can inspect a deferral. Production accounts would only see their authorized outlet.
- No dataset is sent to the image tool. The artwork uses an original logistics scene and the user-supplied sketch as a style reference.

## 03 · Personas

### Amaya Jayasinghe · Dispatcher

**Context:** A large screen at the Peliyagoda planning office, stable connectivity, and competing requests from three brands. **Goal:** create a feasible plan and explain what cannot be served. **Pressure:** Fresh's 8 AM deadline, mall windows, cold-chain scarcity, weekly fuel and prior deferrals. **Design response:** an overview of exceptions alongside routes, independent weight/volume bars, home-depot context, explicit deferral reasons and publication to loading teams. **Success signal:** she can identify a window conflict, record a decision and see the resulting store-facing message without making a phone call. This is a composite persona based on the brief, not an interviewed individual.

### Ruwan Kumara · Loader

**Context:** A shared tablet at a busy loading dock; the last printed list may already be outdated. **Goal:** prepare the right cargo so early stops can be unloaded without moving later cargo. **Pressure:** departure time, missing crates, damaged goods, and cold-chain handling. **Design response:** route/version identification, reverse stop loading, large check targets and a shortfall report before departure readiness. **Success signal:** a shortfall includes its type and affected order, and the dispatcher sees it. Persona names and biography are illustrative.

### Kasun Perera · Driver

**Context:** A personal phone, variable coverage and a vehicle that must be safely stopped before interaction. **Goal:** reach the right entrance, know the receiving window and leave a clear delivery record. **Pressure:** hill-country signal loss, access surprises and receiving disputes. **Design response:** one prominent next stop, readable arrival/access details, a parked-use reminder, offline capture and a visible pending-sync state. **Success signal:** proof survives a refresh and can be synchronized without duplicate completion.

### Anjali Fernando · Store manager

**Context:** A counter desktop or phone while coordinating receiving staff and serving customers. **Goal:** know whether an order is accepted, when to prepare staff and what actually arrived. **Pressure:** shelves running low, unannounced deferrals and ambiguous quantities. **Design response:** an ETA with stage history, visible deferral reason and next eligible run, confirmation after driver proof and a next-day ordering flow with a cutoff state. **Success signal:** she can distinguish a submitted order from an assigned vehicle and acknowledge a received delivery.

## 04 · Connected flow

Store order → cutoff acknowledgement → dispatcher queue → route/constraint review → explicit allocation or deferral → plan publication → loader reverse sequence → readiness or shortfall → driver delivery proof → offline queue if needed → reconnection → store receipt or issue.

**Normal walkthrough:** Dispatcher publishes the representative plan. Loader sees v2, checks three sample loads, and marks the vehicle ready. Driver records proof for WP-2041. Store manager sees delivery completion and confirms receipt. Status and notifications are shared within this browser session and survive refresh.

**Exception walkthrough:** Dispatcher reviews WP-2043, sees the 12-minute mall conflict, records a reason and defers it. Store manager selects Style · Colombo City Centre and sees the reason and next-run notice. An existing Kadawatha deferral remains visible for priority review.

## 05 · Dispatcher screen rationale

**Overview.** The hierarchy answers three questions: is the network healthy, where is the risk, and what should I do next? The artwork provides identity and human context in a compact banner. Metrics sit above the map and route inspector; the exceptions strip leads into the detailed queue. Brand colors never replace textual labels. “Live demo” and the footer distinguish simulated state from live operations.

**Network map and route inspector.** A schematic map shows both hubs without requiring an external map token or connectivity. Selecting a route updates the inspector, making the graphic an entry point to operational detail. Zoom, traffic-layer toggle, depot filtering and expansion support exploration. Positions are explicitly illustrative; no geographic routing accuracy is claimed.

**Orders.** A search and brand/status filters reduce the queue to relevant work. Order ID, outlet, temperature, access window, vehicle and status are available without opening separate spreadsheets. The detail dialog exposes weight and volume independently. Export produces a CSV of the current filtered sample records, providing a tangible review artifact.

**Dispatch planner and publication.** Three representative route cards show capacity, depot and trip context. A publication review names the six operational checks rather than hiding them behind an “optimize” button. The acknowledgement requires a deliberate action before v2 reaches the loader. These are designed validation states, not a implemented optimization algorithm; unresolved exceptions remain explicit.

**Fleet and outlets.** Fleet cards expose temperature capability, vehicle class, home depot and both loading constraints. Outlet cards expose local access rules and receiving windows. These supporting screens explain why a choice is constrained; they are not a fleet-administration subsystem.

**Capacity insights.** A weekly brand-volume chart and capacity outlook illustrate future decision support. A period switch demonstrates comparison while the screen labels the figures as illustrative. Forecast modeling belongs to the Datathon and is not implemented here.

## 06 · Loader screen rationale

**Loading dock.** A published plan version anchors the loader to current dispatch instructions. The three-stop representative list explicitly says “load first” for the last delivery and “load last” for the first, avoiding a hidden reversal. Each row acts as a large check control; the summary indicates progress. Departure readiness is disabled until all three loads are checked.

**Shortfall report.** The loader can report missing items, damaged goods or a temperature concern before marking readiness. The type and free-text context are preserved in the dispatch activity inbox. A production build should attach an order ID, affected quantity and plan version as structured data and require dispatcher resolution before a shortfall-affected vehicle departs. In this prototype the report demonstrates the handoff; readiness is not a safety enforcement system.

**Readiness confirmation.** A short final dialog confirms the checked sample loads and produces a dispatch notification. It avoids asking the loader to manage routes, driver scheduling or exceptions that belong to the dispatcher.

## 07 · Driver and store screen rationale

**Driver next stop.** The next outlet, receiving window, expected arrival and unloading entrance dominate. A simple route timeline provides orientation without putting map interaction ahead of the next required task. Instructions explicitly call for use while parked. The delivery action collects receiving contact, crate count and a proof note.

**Delivery proof.** The form preserves who received the goods, how many crates arrived and the condition/location note. It accepts a quantity shortfall without pretending it is full receipt. The proof note is the implemented prototype representation; photo capture, signatures and immutable media storage remain for the later build.

**Store delivery and receipt.** A visible stage timeline separates acceptance, scheduling, transit and delivery. Receipt confirmation is unavailable until delivery proof synchronizes. The store can record a receiving note or report a discrepancy; driver completion is not equated with store acceptance.

**Next-day order.** Separate chilled and ambient choices make vehicle needs explicit. Before the 4 PM cutoff, the sample order is acknowledged for Tuesday; the after-cutoff toggle demonstrates Wednesday routing. Acknowledgement does not claim that an unassigned order already has a vehicle. This form illustrates the Fresh order journey; Style weekly scheduling and Tech item-level requests need their own future variants.

## 08 · Failure scenario A — A mall window is closing

**Why it matters.** Style deliveries can consume volume before weight, and mall bays have fixed access windows. Sending a driver to a closed bay wastes time, quota and capacity that another outlet might need. A “late” label alone gives the dispatcher neither an action nor a defensible record.

**Designed response.** The exception screen compares a 10:42 arrival against a 10:30 closure, displays access/size, offers a reasoned deferral or a request for access review, and preserves context for the store. Requesting review keeps the order at risk: it does not silently approve a later window. A fairness note makes yesterday's Kadawatha skip visible. The successful state explains the next handoff, and the affected store sees the recorded deferral.

**Boundaries.** Tuesday is the next eligible operating run in this fixed scenario, not a guaranteed delivery slot. Actual rescheduling must honor the outlet's calendar and brand schedule. A production version needs an auditable actor/time history, receiving-window approval and constrained reallocation; this phase demonstrates decision quality and communication.

## 09 · Failure scenario B — Signal lost, proof protected

**Why it matters.** Coverage loss in the Kandy corridor and rural districts must not force the driver to reconstruct receiving evidence later. The problem is not only whether a form can be submitted: the driver must know whether it is saved and whether the store can see it.

**Designed response.** “Simulate offline” changes the connection banner and delivery action to “Save proof offline.” A local queue stores the proof and survives refresh. The delivered status does not reach the store until “Reconnect & sync.” A pending state prevents the same order from being completed again. After synchronization the store may confirm receipt.

**Recovery and limitations.** This is a simulated connection state using localStorage after the app is loaded, not a service worker or real backend sync. It cannot cold-start offline or synchronize across devices. Clearing browser storage loses the demonstration records. The later implementation should use durable IndexedDB, operation IDs, server acknowledgement, retry/backoff and explicit conflict review. For a conflict, retain both proofs and show a dispatcher review task; never overwrite a completed receipt silently. The conflict policy is documented, not implemented.

## 10 · Visual system and interaction principles

**Art direction:** soft pencil crosshatching, dusty-blue/lavender watercolor washes, sage botanicals, warm human skin tones and white paper edges. The user-supplied recruitment sketch established the requested style. The selected artwork is an original logistics scene, not the recruitment image reused as a background.

**Palette:** slate sidebar #232D3C; blue primary #5C759C; canvas #F5F6F8; white surfaces; sage, amber and lavender status accents. Darker slate ink is used for operational copy, with textual status labels and icons alongside color. Plus Jakarta Sans handles readable controls and operational copy. Instrument Serif, in regular and italic styles, provides expressive editorial headings. Both families are bundled locally. Seven original pencil/watercolor scenes form a coherent illustration system across the overview, all four roles, fleet, outlets and capacity planning. Clickable illustrated journey cards connect the role experiences.

**Components:** compact global navigation; role switch; responsive cards; selectable routes; capacity bars; labeled status badges; filterable table; focused dialogs; inline error/recovery states; toast feedback; and a guided role tour. Dialogs use focus containment and Escape dismissal. A skip link, semantic controls, labeled inputs, reduced-motion handling and mobile layouts support accessibility. Automated audits are useful evidence, not a substitute for testing with users and assistive technology.

**Responsiveness:** the dispatcher retains a dense large-screen overview; smaller screens use stacked cards, a navigation drawer and an internally scrollable delivery table. Driver and loader tasks remain a single-column sequence on phone-sized screens, with larger primary actions. The illustration stays decorative and never contains essential text.

## 11 · Main tradeoff

**Human judgment with visible constraints, rather than unexplained automated allocation.** The challenging design moment is deciding which outlet waits when capacity is insufficient. The prototype spends detail on evidence, explicit reasons, previously skipped outlets and the consequences for the receiving team. Automatic allocation could reduce planning time, but without understandable tradeoffs it can reproduce the same opaque deferral problem. The later allocator should propose feasible options; the dispatcher should understand why those options exist. This is a scope choice for the Designathon, not a claim that manual planning is inherently superior.

## 12 · AI disclosure and submission readiness

**AI-assisted work:** Codex read the provided brief, synthesized composite personas, proposed flows, wrote the Next.js/React/TypeScript/Tailwind prototype, authored the explanatory documents and browser tests, and iterated on layout. The built-in image generation tool created the selected logistics illustration from a prompt and the user-provided style reference. The exact prompts and asset paths are in `docs/ART-DIRECTION.md` and `docs/ILLUSTRATION-SYSTEM.md`.

**Human-provided inputs:** the challenge booklet, the user's Designathon-only scope, the requested technology stack and the sketch style reference. No human interviews, field visits or independent human code/design review are claimed. No predictive models were trained. No real operational service is connected.

**Before submission:** replace TeamName with the actual team name; reconcile the demonstration records with the supplied shared CSVs if required by the organizers; review all assumptions; host the prototype to obtain a shareable URL; review the captioned local 3–5 minute walkthrough video (or record narration using the supplied script); upload the video as unlisted; and place the final URLs in the form. The generated design-book PDF/HTML and source package are local review artifacts. Hosting, YouTube upload and competition submission have not been performed.
