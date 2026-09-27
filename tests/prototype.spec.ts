import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function role(page: Page, name: string) {
  await page.locator(".role-switch").click();
  await page
    .locator(".role-menu")
    .getByRole("button")
    .filter({ has: page.getByText(name, { exact: true }) })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good morning, Amaya" }),
  ).toBeVisible();
});
test("route map, depot filter and order search are interactive", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Select Kandy highland run" }).click();
  await expect(page.locator(".route-title")).toContainText(
    "Kandy highland run",
  );
  await page.getByLabel("Filter map by depot").selectOption("Kandy");
  await expect(
    page.getByRole("button", { name: "Select Colombo morning run" }),
  ).toHaveCount(0);
  await page.getByLabel("Filter map by depot").selectOption("All depots");
  await page.getByLabel("Search orders").fill("Kadawatha");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "View order WP-2045" }).click();
  await expect(page.getByRole("dialog")).toContainText("Van only");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("a deferral carries its reason into the affected store", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Review exceptions" }).first().click();
  await page
    .getByLabel("Context for the store")
    .fill("Receiving team requested Tuesday morning.");
  await page
    .getByRole("button", { name: "Record decision & notify store" })
    .click();
  await page.getByRole("button", { name: "Back to overview" }).click();
  await role(page, "Store manager");
  await page.getByLabel("Switch example store").selectOption("WP-2043");
  await expect(
    page.getByRole("heading", { name: "A change to your delivery." }),
  ).toBeVisible();
  await expect(page.locator(".store-delivery")).toContainText(
    "Receiving team requested Tuesday morning.",
  );
});
test("plan publication reaches the loader and load readiness requires checks", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Build dispatch plan" }).click();
  await expect(
    page.getByRole("button", { name: "Publish plan to loading teams" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Publish plan to loading teams" })
    .click();
  await role(page, "Loader");
  await expect(page.locator(".load-summary")).toContainText("Published · v2");
  await expect(
    page.getByRole("button", { name: "Mark ready to depart" }),
  ).toBeDisabled();
  for (const item of await page.locator(".loading-item").all())
    await item.click();
  await page.getByRole("button", { name: "Mark ready to depart" }).click();
  await page.getByRole("button", { name: "Confirm vehicle readiness" }).click();
  await role(page, "Dispatcher");
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(page.locator(".notification-panel")).toContainText(
    "WP-012 ready to depart",
  );
});
test("offline proof survives reload, syncs once and closes the receipt loop", async ({
  page,
}) => {
  await role(page, "Driver");
  await page.getByRole("button", { name: "Simulate offline" }).click();
  await page.getByRole("button", { name: "Record delivery & proof" }).click();
  await page.getByLabel("Receiving contact").fill("Anjali Fernando");
  await page
    .getByLabel("Proof note / discrepancy")
    .fill("24 sealed crates handed over at rear dock.");
  await page.getByRole("button", { name: "Save proof offline" }).click();
  await page.reload();
  await expect(page.getByText("1 record waiting to sync")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Proof saved · awaiting sync" }),
  ).toBeDisabled();
  await role(page, "Store manager");
  await expect(
    page.getByRole("button", { name: "Confirm receipt" }),
  ).toBeDisabled();
  await role(page, "Driver");
  await page.getByRole("button", { name: "Reconnect & sync" }).click();
  await expect(
    page.getByRole("button", { name: "Delivery recorded", exact: true }),
  ).toBeDisabled();
  await role(page, "Store manager");
  await expect(page.locator(".store-delivery")).toContainText(
    "24 sealed crates handed over at rear dock.",
  );
  await page.getByRole("button", { name: "Confirm receipt" }).click();
  await page.getByRole("checkbox").check();
  await page
    .getByLabel("Receiving note (optional)")
    .fill("All quantities verified.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm receipt" })
    .click();
  await expect(
    page.getByRole("button", { name: "Receipt confirmed" }),
  ).toBeDisabled();
  const receipt = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("waypoint-orders-v1")!).find(
      (o: { id: string }) => o.id === "WP-2041",
    ),
  );
  expect(receipt.receiptNote).toBe("All quantities verified.");
});
test("cutoff scenario puts late orders on the following operating run", async ({
  page,
}) => {
  await role(page, "Store manager");
  await page.getByRole("button", { name: "Place a new order" }).click();
  await page.getByLabel("Number of crates").fill("12");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Confirm order", exact: true })
    .click();
  await role(page, "Dispatcher");
  await page.getByLabel("Search orders").fill("WP-2106");
  await expect(page.locator("tbody")).toContainText("Wed 30 Sep");
});
test("loading issues retain issue type and reach dispatch activity", async ({
  page,
}) => {
  await role(page, "Loader");
  await page.getByRole("button", { name: "Report a shortfall" }).click();
  await page.getByLabel("Issue type").selectOption("Damaged goods");
  await page
    .getByLabel("What happened?")
    .fill("WP-2041: two damaged crates, replacements needed.");
  await page.getByRole("button", { name: "Send issue to dispatcher" }).click();
  await role(page, "Dispatcher");
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(page.locator(".notification-panel")).toContainText(
    "Damaged goods: WP-2041",
  );
});
test("mobile roles fit the viewport and menu stays reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Loading dock", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A good journey starts here." }),
  ).toBeVisible();
  for (const r of ["Driver", "Store manager"]) {
    await role(page, r);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
});
test("core screen passes automated accessibility checks", async ({ page }) => {
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
});

test("store context keeps the selected order ETA and delivery stage", async ({
  page,
}) => {
  await role(page, "Store manager");
  await page.getByLabel("Switch example store").selectOption("WP-2044");
  await expect(page.locator(".store-delivery .arrival-time")).toContainText(
    "11:15",
  );
  await expect(page.locator(".delivery-timeline .done")).toHaveCount(2);
  await expect(page.locator(".store-delivery")).toContainText(
    "Your delivery is scheduled.",
  );
  await page.getByLabel("Switch example store").selectOption("WP-2043");
  await expect(page.locator(".store-delivery .arrival-time")).toContainText(
    "10:42",
  );
  await expect(page.locator(".store-delivery")).toContainText(
    "Your arrival window needs review.",
  );
});

test("illustrated journey cards open their connected role experiences", async ({
  page,
}) => {
  await page.getByRole("button", { name: /A considered beginning/ }).click();
  await expect(
    page.getByRole("heading", { name: "A good journey starts here." }),
  ).toBeVisible();
  await expect(page.locator(".role-heading-art")).toHaveAttribute(
    "src",
    /loading-dock/,
  );
  await role(page, "Dispatcher");
  await page
    .getByRole("button", { name: /A little further, together/ })
    .click();
  await expect(page.locator(".role-heading-art")).toHaveAttribute(
    "src",
    /on-the-road/,
  );
});
