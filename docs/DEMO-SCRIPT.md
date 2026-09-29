# Waypoint · Designathon demo script (about 4½ minutes)

Record the **Prototype** page of the Figma file in Present mode at 1440px, starting from **00 · Start here**. Speak the lines in quotes; the bracketed notes say what to show or click. The brief asks for a 3-5 minute walkthrough of the design workflow and the assumptions behind it, uploaded to YouTube as an unlisted video.

---

## 0:00 to 0:30 · The problem

*[Start screen: "Three journeys, one shared record."]*

"Waypoint runs three brands on one fleet, and their needs compete. Fresh has to reach 80 supermarkets before 8 AM, and chilled goods need one of only 16 refrigerated vehicles. Style fills a truck by volume before weight and often has to fit a mall's fixed access window. Tech is heavy, fragile and unpredictable. Today the plan lives in a spreadsheet and one dispatcher's head, and everything else happens over phone calls and paper run sheets.

We designed one delivery record that four people can act on: the dispatcher, the loader, the driver and the store manager. I'll walk through three journeys: a normal day, and two days when things go wrong."

## 0:30 to 1:45 · Flow 1: From plan to receipt

*[Click the Flow 01 card.]*

"This is Amaya, our dispatcher, at a large screen in the Peliyagoda planning office. Before she publishes, the plan review lists the checks that matter: weight and volume, temperature, delivery windows, home depot, fuel and trip limits, and fairness to outlets that were skipped before. Publishing stays disabled until she confirms that review."

*[Click "Publish plan to loading teams".]*

"Ruwan, at the loading dock, sees the plan's version, v2, on a shared tablet, so an outdated printout can't mislead him. Stops are listed in reverse order: the last delivery goes in first, so the first delivery comes out first. He can only mark the vehicle ready once every load is checked."

*[Click "Mark ready to depart", then "Confirm vehicle readiness".]*

"That readiness goes straight back to the dispatcher. Amaya sees 'WP-012 ready to depart' in her activity inbox, with no phone call needed."

*[Click the role switch to go to the Driver.]*

"Kasun, our driver, records proof of delivery when he's safely parked: who received it, how many crates, and a note, so a dispute never depends on memory."

*[Click "Complete delivery".]*

"Anjali, the store manager, sees the driver's proof, checks it against her order and confirms receipt. The loop closes, and every role now sees the same completed delivery."

*[Click "Confirm receipt", then the logo to move on.]*

## 1:45 to 2:40 · Flow 2: A mall window is closing

"Our first failure scenario. Style's City Centre outlet sits in a mall whose loading bay closes at 10:30, and the planned arrival is 10:42."

*[Click "Review exceptions".]*

"Instead of just a red 'late' label, the dispatcher gets a decision to make. The screen compares the arrival time with the access window, shows the order's size and access rules, and offers two options: defer it with a reason, or request an access review, which keeps the order visibly at risk. A fairness note reminds her that Kadawatha was already skipped yesterday, so the same outlet isn't left unserved on consecutive runs. She adds context for the store and records the decision."

*[Click "Record decision & notify store", then "Back to overview".]*

"And the store isn't left guessing: the manager sees the deferral, the reason and the next eligible run. That's the booklet's 'deferrals lack a clear record' problem, answered with a reason that reaches the people it affects."

*[Click the logo to move on.]*

## 2:40 to 3:50 · Flow 3: Signal lost, proof protected

"Our second failure scenario is signal loss in the Kandy corridor and the hill country. When coverage drops, the driver's banner changes and the main action becomes 'Save proof offline'."

*[Click "Record delivery & proof", then "Save proof offline".]*

"The proof is saved to a queue on the phone, and it survives a refresh. The button locks, so the same stop can't be completed twice."

*[Click the role switch to go to the Store manager.]*

"Crucially, the store isn't told too early. 'Confirm receipt' stays disabled, because the delivery hasn't actually synced yet."

*[Switch back to Driver, then click "Reconnect & sync".]*

"When the signal returns, the driver reconnects, the queued record syncs once, and the delivery is recorded."

*[Switch to Store manager.]*

"Now the store sees the proof note and can close the loop."

## 3:50 to 4:30 · Assumptions, tradeoff and disclosure

*[Open the Style Guide page, then the Design Book pages for the tradeoff and disclosure.]*

"A few assumptions shaped this design. The review day is fixed at Monday 28 September at 6:30 AM. The orders, routes and names are illustrative records, not the official dataset. Offline sync is a designed state model, not production synchronization. And the stages are compressed, so one person can walk through the whole journey.

Our main tradeoff: we favored human judgment with visible constraints over an unexplained automatic allocator. Later, an allocator should propose feasible options, and the dispatcher should always understand why.

One style guide keeps the four roles consistent: Fraunces and DM Sans typography, shared buttons, and status badges that always include a text label, not just a color. Our AI tool disclosure is in the design book. Thank you."

---

**Before recording**
- Reset the demonstration state in the live app (Prototype guide), in case you show the live app alongside the Figma prototype.
- In Figma, set the prototype to "anyone with the link can view" so judges can open it.
- Don't claim user research, official dataset integration, live telemetry, production offline sync or forecast accuracy.
- The older captioned video in `deliverables/Waypoint_Designathon_Demo.mp4` has no narration and predates the font change. Record a fresh one with this script.
