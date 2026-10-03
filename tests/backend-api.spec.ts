import { test, expect } from "@playwright/test";

test.describe("Waypoint Backend, Database & API Endpoints", () => {
  test("Auth API: Seeds and authenticates 4 official role accounts", async ({ request }) => {
    const listRes = await request.get("/api/auth");
    expect(listRes.ok()).toBe(true);
    const listData = await listRes.json();
    expect(listData.seededAccounts).toHaveLength(4);

    // Test Dispatcher login
    const loginRes = await request.post("/api/auth", {
      data: { email: "amaya@waypoint.lk" },
    });
    expect(loginRes.ok()).toBe(true);
    const loginData = await loginRes.json();
    expect(loginData.user.role).toBe("Dispatcher");
    expect(loginData.user.name).toBe("Amaya Jayasinghe");
  });

  test("Outlets & Fleet Datasets: Ingests 120 outlets and 60 vehicles", async ({ request }) => {
    const outletsRes = await request.get("/api/outlets");
    expect(outletsRes.ok()).toBe(true);
    const outletsData = await outletsRes.json();
    expect(outletsData.count).toBe(120);

    const fleetRes = await request.get("/api/fleet");
    expect(fleetRes.ok()).toBe(true);
    const fleetData = await fleetRes.json();
    expect(fleetData.count).toBe(60);

    // Verify 16 refrigerated vehicles in fleet (12 trucks + 4 vans)
    const reeferVehicles = fleetData.vehicles.filter((v: any) => v.temp === "reefer");
    expect(reeferVehicles).toHaveLength(16);
  });

  test("Orders & 4 PM Cutoff Rule: Schedules on-time orders and defers late orders", async ({ request }) => {
    // 1. Order before cutoff
    const onTimeRes = await request.post("/api/orders", {
      data: {
        outlet_id: "OUT001",
        brand: "Fresh",
        amount: "500 kg",
        volume: "3.5 m³",
        temp_requirement: "chilled",
        force_after_cutoff: false,
      },
    });
    expect(onTimeRes.ok()).toBe(true);
    const onTimeData = await onTimeRes.json();
    expect(onTimeData.order.cutoff_status).toBe("on_time");
    expect(onTimeData.order.dispatch_status).toBe("scheduled");

    // 2. Order after 4 PM cutoff
    const lateRes = await request.post("/api/orders", {
      data: {
        outlet_id: "OUT003",
        brand: "Fresh",
        amount: "300 kg",
        volume: "2.1 m³",
        temp_requirement: "chilled",
        force_after_cutoff: true,
      },
    });
    expect(lateRes.ok()).toBe(true);
    const lateData = await lateRes.json();
    expect(lateData.order.cutoff_status).toBe("after_cutoff");
    expect(lateData.order.dispatch_status).toBe("deferred");
    expect(lateData.order.eta).toContain("After 4 PM cutoff");
  });

  test("Plan API: Solves allocation, enforces 7 constraints, and publishes plan", async ({ request }) => {
    const solveRes = await request.post("/api/plan", {
      data: { strategy: "priority_first" },
    });
    expect(solveRes.ok()).toBe(true);
    const solveData = await solveRes.json();
    expect(solveData.report.is_valid).toBe(true);
    expect(solveData.report.violations).toHaveLength(0);

    const publishRes = await request.put("/api/plan", {
      data: { published_by: "Amaya Jayasinghe" },
    });
    expect(publishRes.ok()).toBe(true);
    const publishData = await publishRes.json();
    expect(publishData.success).toBe(true);
  });

  test("Loader API: Provides reverse loading sequence and shortfall flagging", async ({ request }) => {
    const loadingRes = await request.get("/api/loading?vehicle_id=VEH001&trip_id=1");
    expect(loadingRes.ok()).toBe(true);
    const loadingData = await loadingRes.json();
    expect(Array.isArray(loadingData.reverseLoadingSequence)).toBe(true);

    // Flag shortfall
    const shortfallRes = await request.post("/api/loading", {
      data: {
        order_id: "ORD0092301",
        vehicle_id: "VEH001",
        trip_id: 1,
        shortfall_type: "damaged",
        shortfall_notes: "Crate seal broken at loading bay 3",
      },
    });
    expect(shortfallRes.ok()).toBe(true);
    const shortfallData = await shortfallRes.json();
    expect(shortfallData.success).toBe(true);
  });

  test("Driver & Sync API: Records Proof of Delivery and synchronizes offline batch queue", async ({ request }) => {
    // Normal POD submission
    const podRes = await request.post("/api/driver", {
      data: {
        order_id: "ORD0092301",
        driver_name: "Kasun Perera",
        recipient_name: "Anjali Fernando",
        items_received: 42,
        proof_notes: "Delivered to cold room. Digital signature verified.",
      },
    });
    expect(podRes.ok()).toBe(true);
    const podData = await podRes.json();
    expect(podData.success).toBe(true);

    // Offline batch sync simulation (Driver reconnected after signal drop)
    const syncRes = await request.post("/api/driver/sync", {
      data: {
        queue: [
          {
            id: "ORD0092306",
            driver_name: "Kasun Perera",
            receiver: "Wattala Manager",
            count: 35,
            proof: "Delivered in hill area offline. Reconnected at 07:15 AM.",
          },
        ],
      },
    });
    expect(syncRes.ok()).toBe(true);
    const syncData = await syncRes.json();
    expect(syncData.synced_count).toBe(1);
  });

  test("Seed Reset API: Successfully resets system to clean baseline", async ({ request }) => {
    const seedRes = await request.post("/api/seed");
    expect(seedRes.ok()).toBe(true);
    const seedData = await seedRes.json();
    expect(seedData.stats.outlets).toBe(120);
    expect(seedData.stats.vehicles).toBe(60);
    expect(seedData.stats.users).toBe(4);
  });
});
