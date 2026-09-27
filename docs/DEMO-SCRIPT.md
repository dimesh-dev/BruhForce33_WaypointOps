# Waypoint · 4-minute demo script

**0:00–0:30 · Frame the problem.** “Three brands share one fleet, but their needs compete. Fresh has an early deadline, Style has volume and mall access constraints, and Tech brings weight and fragility. We designed one delivery record that each role can act on.” Show the four personas in the design book. Explain that these are brief-grounded composite personas and illustrative records.

**0:30–1:15 · Dispatcher.** Show the overview. Select the Kandy route on the map, then return to Colombo. Open the mall exception. Explain the 10:42 versus 10:30 conflict, previous deferral visibility, and recorded reason. Defer it with the note “Next eligible run, subject to access confirmation.” Publish the sample plan after reviewing the six constraints.

**1:15–1:50 · Loader.** Switch to Loader. Point out plan v2 and the reverse delivery sequence. Flag damaged goods with an order and quantity, then show the report in dispatcher notifications. Return and check the three sample loads; confirm readiness. Explain that production dispatch resolution and version locking are later implementation work.

**1:50–2:50 · Driver failure and recovery.** Switch to Driver. Mention use while safely stopped. Enable “Simulate offline.” Enter a receiving contact, quantity and proof note. Save offline, refresh and show the pending record. Switch to Store manager to show receipt is still unavailable. Return to Driver, reconnect and synchronize. Explain that this demonstrates the offline state model with local storage, not a production backend or cold-start offline shell.

**2:50–3:25 · Store.** Show synchronized proof, confirm the receipt, then select Style · Colombo City Centre to show the deferral reason. Return to the Fresh ordering example, place an order and demonstrate the after-4-PM branch. Distinguish confirmation from vehicle assignment.

**3:25–4:00 · Tradeoff and disclosure.** “We prioritized an understandable decision and a dependable handoff over a black-box optimizer. The sketch style keeps the experience human; the operational data stays readable.” Show the design-book tradeoff, assumptions and AI disclosure. State that Next.js, React, TypeScript and Tailwind power the prototype, and that routing, allocation and forecast models are outside this Designathon submission.

A captioned local walkthrough is included at `deliverables/Waypoint_Designathon_Demo.mp4`. It has no voice narration; use this script if recording your own narration. Review it before uploading.

Record at 1440px desktop width, plus a 390px driver/loader segment. Reset demonstration state from Prototype guide before recording. Do not claim user research, official dataset integration, live telemetry, production offline synchronization or forecasting accuracy.
