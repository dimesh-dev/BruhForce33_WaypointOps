import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));
await page.goto("http://localhost:3002", { waitUntil: "networkidle" });
await page.screenshot({ path: "docs/desktop-preview.png", fullPage: true });
console.log("TITLE:", await page.title());
console.log("BODY:", (await page.locator("body").innerText()).slice(0, 200));
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "docs/mobile-preview.png", fullPage: true });
await browser.close();
