import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
execFileSync("python3", ["scripts/build-design-book.py"], { stdio: "inherit" });
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto("file://" + resolve("public/design-book.html"), {
  waitUntil: "load",
});
const overflow = await page
  .locator(".content")
  .evaluateAll((els) =>
    els
      .map((e, i) => ({
        section: i + 1,
        width: e.scrollWidth,
        client: e.clientWidth,
        height: e.scrollHeight,
        visible: e.clientHeight,
      }))
      .filter((e) => e.width > e.client + 2 || e.height > e.visible + 2),
  );
if (overflow.length)
  throw Error("Design book text overflows: " + JSON.stringify(overflow));
await page.pdf({
  path: "docs/Waypoint_Designathon.pdf",
  printBackground: true,
  preferCSSPageSize: true,
});
console.log("Exported docs/Waypoint_Designathon.pdf");
await browser.close();
