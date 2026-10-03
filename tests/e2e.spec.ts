import {
  test,
  expect,
  type Browser,
  type Page,
  type APIRequestContext,
} from "@playwright/test";

/*
 * The judge walkthrough, automated: store order -> close & plan -> manual edit
 * rejected by validation -> publish -> loading with a shortfall -> offline
 * delivery that survives a reload -> sync -> store receipt.
 * Requires a running app with a database (see playwright.config.ts).
 */

const PASSWORD = process.env.DEMO_PASSWORD ?? "waypoint2026";
const phone = { width: 390, height: 844 };

async function session(
  browser: Browser,
  username: string,
  viewport = { width: 1440, height: 1000 },
) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const res = await page.request.post("/api/auth/login", {
    data: { username, password: PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return { context, page, api: page.request };
}

async function json<T>(
  req: APIRequestContext,
  url: string,
  data?: unknown,
): Promise<{ status: number; body: T }> {
  const res =
    data === undefined ? await req.get(url) : await req.post(url, { data });
  return { status: res.status(), body: (await res.json()) as T };
}

test.describe.configure({ mode: "serial" });

test("full four-role walkthrough", async ({ browser }) => {
  const dispatcher = await session(browser, "dispatcher");
  expect((await json(dispatcher.api, "/api/admin/reset", {})).status).toBe(200);
  const me = await json<{ run_date: string }>(dispatcher.api, "/api/me");
  const runDate = me.body.run_date;

  // 1. Store manager places a chilled order before the cutoff.
  const store = await session(browser, "store", phone);
  await store.page.goto("/");
  await store.page.getByRole("button", { name: "Place a new order" }).click();
  await store.page.getByRole("button", { name: "Place order" }).click();
  await expect(store.page.getByText(/received for/)).toBeVisible();

  // 2. Dispatcher closes the queue and generates the plan.
  expect(
    (await json(dispatcher.api, "/api/dispatch/close", { run_date: runDate }))
      .status,
  ).toBe(200);
  const gen = await json<{
    planId: number;
    summary: { deferred: number; served: number };
  }>(dispatcher.api, "/api/plans", { run_date: runDate });
  expect(gen.status).toBe(200);
  expect(gen.body.summary.deferred).toBeGreaterThan(0);

  // 3. A manual change that breaks a rule is rejected with the rule.
  const board = await json<{
    trips: {
      vehicle_id: string;
      vehicle_temp: string;
      stops: { order_id: string; temp_requirement: string }[];
    }[];
  }>(dispatcher.api, `/api/dispatch?date=${runDate}`);
  const chilled = board.body.trips
    .flatMap((t) => t.stops)
    .find((s) => s.temp_requirement === "chilled")!;
  const ambientTruck = board.body.trips.find(
    (t) => t.vehicle_temp === "ambient",
  )!;
  const bad = await json<{ details: { rule: string }[] }>(
    dispatcher.api,
    `/api/plans/${gen.body.planId}/edit`,
    {
      type: "assign",
      order_id: chilled.order_id,
      vehicle_id: ambientTruck.vehicle_id,
    },
  );
  expect(bad.status).toBe(422);
  expect(bad.body.details.map((d) => d.rule)).toContain("R2");

  // 4. Publish from the planner UI.
  await dispatcher.page.goto("/#Dispatch%20planner");
  await dispatcher.page.getByRole("button", { name: /Publish v/ }).click();
  await expect(
    dispatcher.page.getByText(/published to the dock/),
  ).toBeVisible();

  // 5. Loader: shortfall holds the vehicle until the dispatcher decides.
  const loader = await session(browser, "loader", phone);
  await loader.page.goto("/");
  await loader.page.locator(".trip-pick", { hasText: "VEH001" }).click();
  await loader.page.getByRole("button", { name: "Report a shortfall" }).click();
  await loader.page
    .getByLabel("What happened?")
    .fill("Two crates short in the chiller pick.");
  await loader.page.getByRole("button", { name: /Send to dispatcher/ }).click();
  await expect(loader.page.getByText(/waiting for dispatcher/)).toBeVisible();
  const issues = await json<{
    issues: { id: number; status: string; kind: string }[];
  }>(dispatcher.api, `/api/dispatch?date=${runDate}`);
  const shortfall = issues.body.issues.find(
    (i) => i.kind === "loading_shortfall" && i.status === "open",
  )!;
  expect(
    (
      await json(dispatcher.api, `/api/issues/${shortfall.id}/resolve`, {
        action: "proceed",
        note: "Crates found on dock 2.",
      })
    ).status,
  ).toBe(200);
  await loader.page.reload();
  await loader.page.locator(".trip-pick", { hasText: "VEH001" }).click();
  for (const item of await loader.page.locator(".loading-item").all()) {
    await item.click();
    await expect(item).toHaveClass(/checked/);
  }
  await loader.page
    .getByRole("button", { name: "Mark ready to depart" })
    .click();
  await expect(loader.page.getByText(/released/)).toBeVisible();

  // 6. Driver: depart, lose coverage, record a delivery offline, survive a reload, reconnect.
  const driver = await session(browser, "driver", phone);
  const dp: Page = driver.page;
  await dp.goto("/");
  await dp.getByRole("button", { name: "Start trip" }).click();
  await expect(
    dp.getByRole("button", { name: "Record delivery & proof" }),
  ).toBeVisible();
  await dp.getByRole("button", { name: "Work offline" }).click();
  await driver.context.setOffline(true);
  await dp.getByRole("button", { name: "Record delivery & proof" }).click();
  await dp.getByPlaceholder("Name of the person receiving").fill("Nimali");
  await dp.getByRole("button", { name: "Save proof on this phone" }).click();
  await expect(dp.getByText(/1 record waiting to sync/)).toBeVisible();
  await driver.context.setOffline(false);
  await dp.reload();
  await expect(dp.getByText(/1 record waiting to sync/)).toBeVisible();
  await dp.getByRole("button", { name: "Reconnect & sync" }).click();
  await expect(dp.getByText(/synchronised/)).toBeVisible();

  // Replaying an already-synced event is idempotent; a second, different record is a conflict, not an overwrite.
  const route = await json<{
    trips: { stops: { id: number; status: string }[] }[];
  }>(driver.api, "/api/driver");
  const delivered = route.body.trips[0].stops.find(
    (s) => s.status === "delivered",
  )!;
  const replay = {
    client_event_id: "e2e-dup",
    kind: "stop.deliver",
    recorded_at: new Date().toISOString(),
    payload: { stop_id: delivered.id, units_delivered: 1 },
  };
  const first = await json<{ results: { status: string }[] }>(
    driver.api,
    "/api/sync",
    { events: [replay] },
  );
  expect(first.body.results[0].status).toBe("conflict");
  const again = await json<{ results: { status: string }[] }>(
    driver.api,
    "/api/sync",
    { events: [replay] },
  );
  expect(again.body.results[0].status).toBe("duplicate");

  // 7. Driver delivers every remaining stop (including the walkthrough store), then the store confirms receipt.
  for (;;) {
    const button = dp.getByRole("button", { name: "Record delivery & proof" });
    if (!(await button.isVisible())) break;
    await button.click();
    await dp
      .getByPlaceholder("Name of the person receiving")
      .fill("Receiving clerk");
    await dp.getByRole("button", { name: "Complete delivery" }).click();
    await expect(dp.getByRole("dialog")).toHaveCount(0);
    await dp.waitForTimeout(600);
  }
  await expect(dp.getByText(/complete\./)).toBeVisible();

  await store.page.reload();
  await store.page
    .getByRole("button", { name: "Confirm what arrived" })
    .first()
    .click();
  await store.page.getByRole("button", { name: "Confirm receipt" }).click();
  await expect(
    store.page.getByText(/Receipt confirmed|Receipt recorded/),
  ).toBeVisible();

  const events = await json<{ events: { type: string }[] }>(
    dispatcher.api,
    "/api/events",
  );
  expect(
    events.body.events.some(
      (e) => e.type === "receipt.confirmed" || e.type === "receipt.disputed",
    ),
  ).toBe(true);
});

test("roles cannot reach each other's actions", async ({ browser }) => {
  const driver = await session(browser, "driver");
  expect(
    (
      await driver.api.post("/api/plans", { data: { run_date: "2026-04-07" } })
    ).status(),
  ).toBe(403);
  const store = await session(browser, "store");
  expect((await store.api.get("/api/dispatch")).status()).toBe(403);
  const anon = await browser.newContext();
  expect((await anon.request.get("/api/driver")).status()).toBe(401);
});

test("driver app opens with its route after a full offline reload (production build)", async ({
  browser,
}) => {
  const driver = await session(browser, "veh002", phone);
  await driver.page.goto("/");
  await driver.page.waitForTimeout(2000);
  await driver.page.reload();
  const controlled = await driver.page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 1500));
    return !!navigator.serviceWorker?.controller;
  });
  test.skip(!controlled, "Service worker only runs in the production build");
  await driver.context.setOffline(true);
  await driver.page.reload();
  await expect(
    driver.page.getByText("You’re offline. Keep going."),
  ).toBeVisible();
  await expect(driver.page.getByText(/TRIP 1/)).toBeVisible();
});
