# Waypoint Delivery Planning & Logistics System
### Tech-Triathlon 2026 · Hackathon Solution

A responsive, offline-first multi-role delivery planning and logistics management web application built for **Waypoint Group (Pvt) Ltd**. Connects ordering, dispatch planning, warehouse loading, road delivery, and store receipt across all four operational roles while strictly enforcing all 7 vehicle, capacity, temperature, and operating constraints.

---

## 🔑 Seeded Account Credentials

The system includes pre-configured seeded accounts for each user role:

| Role | Email / Login | Name | Assigned Location / Asset |
| :--- | :--- | :--- | :--- |
| **Dispatcher** | `dispatcher@waypoint.lk` | Amaya Jayasinghe | Peliyagoda Planning Office |
| **Loader** | `loader@waypoint.lk` | Ruwan Kumara | Peliyagoda Loading Dock 03 |
| **Driver** | `driver@waypoint.lk` | Kasun Perera | Vehicle `VEH001` (Refrigerated Truck) · Route `R-012` |
| **Store Manager** | `storemanager@waypoint.lk` | Anjali Fernando | Outlet `OUT001` (Waypoint Fresh · Colombo 03) |

---

## 🚀 Quick Start Instructions

### Option 1: Docker Compose (Recommended)

Start the complete application, persistent database, and pre-seeded dataset with a single command:

```bash
docker compose up --build
```

Access the application at **`http://localhost:3000`**.

### Option 2: Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧭 Numbered Judge Walkthrough

Follow this step-by-step walkthrough to traverse the entire operational loop across all four roles:

### Step 1: Store Manager Experience (`storemanager@waypoint.lk`)
1. Open [`http://localhost:3000`](http://localhost:3000) and switch to the **Store Manager** role using the top-right role switcher (or select `Anjali Fernando`).
2. Notice the live order status for **Waypoint Fresh · Colombo 03** (`OUT001`), displaying expected arrival ETA and the receiving staff schedule.
3. Use the store picker dropdown to select **Waypoint Fresh · Kadawatha** (`WP-2045`). Observe the **Deferral Notice with Recorded Rationale** explaining why the order was deferred on the previous run, with starvation protection applied for the next run.
4. Click **New order**, place a Fresh order (chilled crates), and toggle the **Demonstrate an order placed after 4 PM** option. Submit the order and verify it is automatically flagged for the following operating run in compliance with the **4 PM Cutoff Rule**.

### Step 2: Dispatcher Control Room (`dispatcher@waypoint.lk`)
1. Switch to the **Dispatcher** role (`Amaya Jayasinghe`).
2. Navigate to **Dispatch planner** from the sidebar or click **Build dispatch plan**.
3. Inspect the **7-Rule Feasibility Audit Bar** verifying:
   - *Rule 1*: Brand & District Isolation
   - *Rule 2*: Refrigeration Matching (Chilled cargo $\rightarrow$ Reefer vehicles)
   - *Rule 3*: Vehicle Access (Van-only outlets $\rightarrow$ Vans)
   - *Rule 4*: Home Depot Matching (Peliyagoda / Kandy)
   - *Rule 5*: Whole Orders (No split delivery)
   - *Rule 6*: Capacity Caps (Trip weight $\le$ vehicle cap, volume $\le$ vehicle cap)
   - *Rule 7*: Trips & Time Budgets (Max 2 trips; Fresh morning $\le 270$ min; Style/Tech day $\le 480$ min)
4. Click **Re-Solve Engine** or toggle solver strategies (*Priority & Fairness First* vs. *Max Capacity Utilization*).
5. Review the **Vehicle Trips & Time** tab and **Deferral Log** tab.
6. Check the confirmation box and click **Publish plan to loading teams**.

### Step 3: Warehouse Loader Dock App (`loader@waypoint.lk`)
1. Switch to the **Loader** role (`Ruwan Kumara`).
2. Note the **Reverse Loading Sequence** (*"Last stop loaded in, first stop unloaded out"* / LIFO) ensuring Stop 1 cargo stays accessible at the rear door.
3. Check all 3 staged loads to complete the loading checklist.
4. Click **Report a shortfall**, select *Damaged goods*, and submit. Notice the shortfall note instantly appears in the dispatcher's activity inbox.
5. Click **Confirm vehicle readiness** to clear the vehicle for departure.

### Step 4: Driver Mobile App (`driver@waypoint.lk`)
1. Switch to the **Driver** role (`Kasun Perera`).
2. Review the turn-by-turn stop sequence for **Route R-012 (Colombo)**.
3. Click **Simulate offline** to replicate a mobile coverage drop in the hill country or dead zone.
4. Click **Record delivery & proof**, enter recipient name (*"Anjali Fernando"*), verify crates, and click **Save proof offline**.
5. Observe that the delivery proof survives page reloads and remains securely queued in **IndexedDB** on the local device.
6. Click **Reconnect & sync**. The **Reconciliation Engine** automatically synchronizes the queued proof to the backend server via `/api/driver/sync` and resolves any state conflicts.

### Step 5: Store Manager Closes the Receipt Loop
1. Switch back to **Store Manager**.
2. Notice the delivery status for Colombo 03 is now updated to **Delivered** with driver proof visible.
3. Click **Confirm receipt**, check the verification box, and submit. The delivery loop is now 100% complete!

---

## ⚙️ Core Engineering & System Features

- **Automated Constraint Solver (`src/lib/allocation-engine.ts`)**: Knapsack and bin-packing optimizer that guarantees 100% feasibility against all 7 competition constraints.
- **Persistent REST API & Storage Layer (`src/lib/db/`)**: File-backed ACID storage with 10 dynamic endpoints for orders, cutoff management, loading sequences, POD records, and seed data.
- **Offline-First PWA & Reconciliation (`src/lib/offline-db.ts` & `src/lib/reconciliation-engine.ts`)**: Service Worker asset caching, IndexedDB proof queueing, and conflict-resolving batch synchronization.
- **Degradation Scenarios (`src/lib/degradation-scenarios.ts`)**: Pre-programmed handling for **Mall Window Timeouts**, **Loading Dock Shortfalls**, and **Vehicle Breakdown Re-Allocation**.

---

## 🧪 Verification & Automated Testing

Run the comprehensive Playwright test suite covering all constraints, API endpoints, and role workflows:

```bash
# Run all 32 automated tests
npm test

# Run TypeScript type validation
npm run typecheck

# Verify production build compilation
npm run build
```

---

## 📚 Documentation & Deliverables

- [Architecture Diagram & Data Model](docs/ARCHITECTURE.md)
- [AI Tool Disclosure](docs/AI-TOOL-DISCLOSURE.md)
- [Designathon Book & Rationale](docs/DESIGNATHON.md)
