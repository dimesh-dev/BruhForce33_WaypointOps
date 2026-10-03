import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.on("pageerror", (error) => console.error("PAGE ERROR:", error.message));
await page.goto("http://localhost:3002", { waitUntil: "networkidle" });
await page.screenshot({ path: "docs/desktop-preview.png", fullPage: true });
await page.screenshot({ path: "docs/overview-screen.png" });
await page.getByRole("button", { name: "Review exceptions" }).first().click();
await page.screenshot({ path: "docs/failure-window-screen.png" });
await page.getByRole("button", { name: "Close dialog" }).click();
async function role(name) {
  await page.locator(".role-switch").click();
  await page
    .locator(".role-menu")
    .getByRole("button")
    .filter({ has: page.getByText(name, { exact: true }) })
    .click();
}
await role("Loader");
await page.screenshot({ path: "docs/loader-screen.png" });
await role("Driver");
await page.getByRole("button", { name: "Simulate offline" }).click();
await page.screenshot({ path: "docs/driver-offline-screen.png" });
await role("Store manager");
await page.screenshot({ path: "docs/store-screen.png" });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
await role("Driver");
await page.screenshot({
  path: "docs/driver-mobile-screen.png",
  fullPage: true,
});
await role("Loader");
await page.screenshot({
  path: "docs/loader-mobile-screen.png",
  fullPage: true,
});
await role("Dispatcher");
await page.screenshot({ path: "docs/mobile-preview.png", fullPage: true });
console.log("Captured eight role, failure and responsive review screens.");
await browser.close();
