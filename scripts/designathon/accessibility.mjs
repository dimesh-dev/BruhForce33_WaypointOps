import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
});
const page = await context.newPage();
await page.goto("http://localhost:3002", { waitUntil: "networkidle" });
const screens = [
  "Overview",
  "Dispatch planner",
  "Orders",
  "Fleet & drivers",
  "Outlets",
  "Insights",
  "Loader",
  "Driver",
  "Store manager",
];
for (const screen of screens) {
  if (["Loader", "Driver", "Store manager"].includes(screen)) {
    await page.locator(".role-switch").click();
    await page
      .locator(".role-menu")
      .getByRole("button")
      .filter({ has: page.getByText(screen, { exact: true }) })
      .click();
  } else if (screen !== "Overview")
    await page
      .locator("nav")
      .getByRole("button", { name: screen, exact: screen !== "Orders" })
      .click();
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  console.log(
    JSON.stringify({
      screen,
      issues: r.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    }),
  );
}
await browser.close();
