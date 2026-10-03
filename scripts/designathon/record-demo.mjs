import { chromium } from "@playwright/test";
import { mkdir, rename } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await mkdir("deliverables", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  recordVideo: {
    dir: "/private/tmp/waypoint-demo-recording",
    size: { width: 1440, height: 1080 },
  },
});
const page = await context.newPage();
await page.goto("http://localhost:3002", { waitUntil: "networkidle" });
async function caption(number, title, body) {
  await page.evaluate(
    ({ number, title, body }) => {
      document.getElementById("demo-caption")?.remove();
      const el = document.createElement("section");
      el.id = "demo-caption";
      Object.assign(el.style, {
        position: "fixed",
        bottom: "20px",
        left: "245px",
        right: "25px",
        zIndex: "9999",
        pointerEvents: "none",
        background: "#233047f5",
        color: "white",
        border: "1px solid #506787",
        borderRadius: "12px",
        padding: "22px 30px",
        fontFamily: "Arial,sans-serif",
        boxShadow: "0 10px 50px #15213a40",
      });
      const k = document.createElement("div");
      k.textContent = `WAYPOINT · DESIGN WALKTHROUGH · ${number} / 14`;
      Object.assign(k.style, {
        fontSize: "10px",
        letterSpacing: "2px",
        color: "#b3c8e8",
        marginBottom: "10px",
      });
      const h = document.createElement("h2");
      h.textContent = title;
      Object.assign(h.style, {
        fontSize: "22px",
        fontWeight: "500",
        margin: "0 0 10px",
      });
      const p = document.createElement("p");
      p.textContent = body;
      Object.assign(p.style, {
        fontSize: "15px",
        lineHeight: "1.6",
        color: "#dce6f3",
        margin: "0",
        maxWidth: "1000px",
      });
      el.append(k, h, p);
      document.body.append(el);
    },
    { number, title, body },
  );
  console.log(`Chapter ${number}: ${title}`);
}
async function hold() {
  await page.waitForTimeout(15000);
}
async function role(name) {
  await page.locator(".role-switch").click();
  await page
    .locator(".role-menu")
    .getByRole("button")
    .filter({ has: page.getByText(name, { exact: true }) })
    .click();
  await page.evaluate(() => window.scrollTo(0, 0));
}
await caption(
  1,
  "One network. Four working realities.",
  "Fresh, Style and Tech share 60 vehicles across two depots. Waypoint connects dispatch decisions, dock readiness, delivery proof and store receipt. This Designathon prototype uses illustrative records.",
);
await hold();
await page.getByRole("button", { name: "Select Kandy highland run" }).click();
await caption(
  2,
  "Start with the decision, then inspect the detail.",
  "Select a route to see its vehicle, driver and progress. The schematic map is interactive, while weight, volume, refrigeration, home depot and receiving windows remain visible in the supporting screens.",
);
await hold();
await page.getByRole("button", { name: "Review exceptions" }).first().click();
await caption(
  3,
  "Failure scenario: the mall window is closing.",
  "A 10:42 arrival misses the mall’s 10:30 access window. The dispatcher can record an explainable deferral or request access review. A review request does not silently extend the window.",
);
await hold();
await page
  .getByLabel("Context for the store")
  .fill(
    "Mall bay unavailable after 10:30. Review the next eligible receiving slot.",
  );
await page
  .getByRole("button", { name: "Record decision & notify store" })
  .click();
await page.getByRole("button", { name: "Back to overview" }).click();
await page.getByRole("button", { name: "Build dispatch plan" }).click();
await caption(
  4,
  "A plan everyone can follow.",
  "Review both capacity limits, temperature, access, home depot, daily trip limits, weekly fuel and previous deferrals. These are designed review states; the allocation engine belongs to the later Hackathon.",
);
await hold();
await page.getByRole("checkbox").check();
await page
  .getByRole("button", { name: "Publish plan to loading teams" })
  .click();
await role("Loader");
await caption(
  5,
  "At the dock: last stop in, first stop out.",
  "The loader sees plan v2 and the reverse delivery sequence. Large checks confirm each sample load. Missing or damaged goods can be reported to dispatch before departure.",
);
for (const row of await page.locator(".loading-item").all()) await row.click();
await hold();
await page.getByRole("button", { name: "Mark ready to depart" }).click();
await page.getByRole("button", { name: "Confirm vehicle readiness" }).click();
await role("Driver");
await page.getByRole("button", { name: "Simulate offline" }).click();
await caption(
  6,
  "Failure scenario: signal lost, proof protected.",
  "The driver gets one clear next stop, access instructions and a receiving window. A lost connection changes the state explicitly. Interactions are intended for use while safely parked.",
);
await hold();
await page.getByRole("button", { name: "Record delivery & proof" }).click();
await page.getByLabel("Receiving contact").fill("Anjali Fernando");
await page
  .getByLabel("Proof note / discrepancy")
  .fill("24 sealed chilled crates received at the rear loading dock.");
await caption(
  7,
  "Capture evidence at the moment of delivery.",
  "Record the receiving contact, actual quantity and condition. This prototype uses a proof note; photo and signature capture are specified for the later build. The offline action saves a pending record.",
);
await hold();
await page.getByRole("button", { name: "Save proof offline" }).click();
await page.reload();
await page.getByText("1 record waiting to sync").waitFor();
await caption(
  8,
  "Saved on this device is different from synchronized.",
  "The pending proof survives a refresh and cannot be completed twice. The store has not yet received a delivered status. This is a localStorage simulation after loading the app, not a production offline service.",
);
await hold();
await role("Store manager");
await caption(
  9,
  "No premature confirmation at the store.",
  "Receipt remains unavailable while the driver’s proof is offline. The store should never be asked to confirm a delivery record it cannot see. The next step is an explicit reconnection.",
);
await hold();
await role("Driver");
await page.getByRole("button", { name: "Reconnect & sync" }).click();
await role("Store manager");
await caption(
  10,
  "Reconnect, share proof, then confirm receipt.",
  "Synchronization updates the shared order. The receiving team can now inspect the proof and confirm what arrived. Driver completion and store acceptance remain separate actions.",
);
await hold();
await page.getByRole("button", { name: "Confirm receipt" }).click();
await page.getByRole("checkbox").check();
await page
  .getByLabel("Receiving note (optional)")
  .fill("All crates checked and received.");
await page
  .getByRole("dialog")
  .getByRole("button", { name: "Confirm receipt" })
  .click();
await page.getByLabel("Switch example store").selectOption("WP-2043");
await caption(
  11,
  "A deferral reaches the person it affects.",
  "The mall store sees the dispatcher’s reason and next eligible run. The order stays visible instead of disappearing. The demonstration store picker is for reviewers; production accounts would have outlet-specific access.",
);
await hold();
await page.getByRole("button", { name: "Place a new order" }).click();
await page.getByRole("checkbox").check();
await caption(
  12,
  "Make the cutoff understandable.",
  "The Fresh ordering example separates chilled from ambient cargo. An order placed after Monday’s 4 PM cutoff moves to Wednesday’s operating run. Order confirmation does not claim that a vehicle is already assigned.",
);
await hold();
await page.getByRole("button", { name: "Close dialog" }).click();
await page.goto("http://localhost:3002/design-book.html", {
  waitUntil: "load",
});
await caption(
  13,
  "Design choices, grounded in working conditions.",
  "The design book contains four brief-based personas, connected flows, screen rationale, two failure scenarios and a style guide. The pencil-and-watercolor direction follows the user’s visual reference.",
);
await hold();
await page
  .locator(".page")
  .filter({
    has: page.getByRole("heading", {
      name: "12 · AI disclosure and submission readiness",
      exact: true,
    }),
  })
  .scrollIntoViewIfNeeded();
await caption(
  14,
  "Prioritization, assumptions and AI disclosure.",
  "We prioritized explainable decisions and role handoffs. Codex assisted with design, code and documents; the illustration used AI generation. No user interviews, official CSV integration, live telemetry or trained predictions are claimed.",
);
await hold();
const video = page.video();
await context.close();
await browser.close();
const file = await video.path();
await rename(file, "/private/tmp/waypoint-designathon-demo.webm");
execFileSync(
  "/opt/homebrew/bin/ffmpeg",
  [
    "-y",
    "-i",
    "/private/tmp/waypoint-designathon-demo.webm",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "deliverables/Waypoint_Designathon_Demo.mp4",
  ],
  { stdio: "ignore" },
);
console.log("Saved deliverables/Waypoint_Designathon_Demo.mp4");
