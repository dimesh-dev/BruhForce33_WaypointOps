# Data model

PostgreSQL 16. The schema lives in `src/server/schema.ts` and is applied idempotently on every start. Reference tables keep the shared dataset column names so the official CSVs load without mapping.

Image export: [diagrams/data-model.png](diagrams/data-model.png)

```mermaid
erDiagram
  district_travel ||--o{ outlets : "district"
  service_allowance }o--o{ outlets : "brand + dock_type"
  calendar ||--o| run_days : "operating date"
  calendar ||--o{ plans : "run_date"
  outlets ||--o{ orders : "places"
  outlets ||--o{ users : "store manager of"
  vehicles ||--o{ users : "driven by"
  vehicles ||--o{ trips : "runs"
  vehicles ||--o{ fuel_ledger : "used fuel"
  users ||--o{ orders : "placed_by"
  plans ||--o{ trips : "contains"
  plans ||--o{ deferrals : "decided"
  trips ||--o{ stops : "sequence"
  orders ||--o{ stops : "served as"
  orders ||--o{ deferrals : "moved by"
  stops ||--o{ proofs : "evidence (append-only)"
  orders ||--o| receipts : "confirmed by store"
  orders ||--o{ issues : "raised about"
  trips ||--o{ issues : "shortfalls"
  users ||--o{ sync_events : "device events"

  outlets {
    text outlet_id PK
    text name
    text brand "Fresh | Style | Tech"
    text district FK
    text depot
    text dock_type "rear_dock | street | mall_bay"
    text parking_constraint "normal | van_only | mall_dock"
    text mall_window "HH:MM-HH:MM"
    text window_open_time
    text window_close_time
  }
  vehicles {
    text vehicle_id PK
    text type "truck | van"
    text temp "reefer | ambient"
    numeric weight_cap_kg
    numeric volume_cap_m3
    numeric km_per_l
    numeric weekly_fuel_quota_l
    text depot
    text status "available | in_workshop"
    text driver_name
  }
  district_travel {
    text district PK
    text depot
    numeric depot_to_district_km
    numeric depot_to_district_freeflow_min
    numeric inter_stop_km
    numeric inter_stop_freeflow_min
  }
  service_allowance {
    text brand PK
    text dock_type PK
    numeric service_allowance_min
  }
  calendar {
    date date PK
    int iso_year
    int iso_week
    int is_payday
    text festival
    numeric festival_ramp
    int is_operating
  }
  users {
    serial id PK
    text username UK
    text password_hash "scrypt"
    text role "dispatcher | loader | driver | store_manager"
    text depot "loader scope"
    text vehicle_id FK "driver scope"
    text outlet_id FK "store scope"
  }
  run_days {
    date run_date PK
    timestamptz cutoff_at "16:00 the day before"
    timestamptz closed_at
  }
  orders {
    text order_id PK
    text outlet_id FK
    date requested_date
    date run_date "current run; moves on deferral"
    text temp_requirement "chilled | ambient"
    int units
    numeric weight_kg
    numeric volume_m3
    text status "confirmed→planned→loaded→in_transit→delivered|failed→received|disputed; deferred"
    int deferred_count "consecutive skips"
    text client_ref UK "idempotent placement"
  }
  plans {
    serial id PK
    date run_date FK
    int version
    text status "draft | published | superseded"
    jsonb summary "service rate, binding constraints"
  }
  trips {
    serial id PK
    int plan_id FK
    text vehicle_id FK
    int trip_no "1 | 2"
    text brand
    text district
    int depart_min
    int trip_minutes "booklet formula"
    numeric weight_kg
    numeric volume_m3
    numeric distance_km
    numeric fuel_l
    text status "planned | loading | blocked | ready | in_transit | completed"
  }
  stops {
    serial id PK
    int trip_id FK
    text order_id FK
    int seq
    int arrival_min
    int window_open_min
    int window_close_min
    text status "pending | arrived | delivered | failed"
    boolean loaded
  }
  proofs {
    serial id PK
    int stop_id FK
    text outcome "delivered | partial | failed"
    text receiver_name
    int units_delivered
    text photo "data URL"
    text signature "data URL"
    timestamptz recorded_at "device time"
    text device_id
    text client_event_id UK
    boolean superseded "kept on conflict"
  }
  deferrals {
    serial id PK
    text order_id FK
    int plan_id FK
    date from_date
    date to_date
    text code "REEFER_CAPACITY, MANUAL, ..."
    text reason "shown to the store"
    boolean unavoidable
  }
  issues {
    serial id PK
    text kind "loading_shortfall | delivery_issue | receipt_issue | sync_conflict"
    text order_id FK
    int trip_id FK
    boolean blocks_departure
    text status "open | resolved"
    text resolution
  }
  receipts {
    text order_id PK
    int units_received
    text condition "complete | short | damaged"
  }
  fuel_ledger {
    serial id PK
    text vehicle_id FK
    int iso_year
    int iso_week
    numeric litres
  }
  sync_events {
    text client_event_id PK
    int user_id FK
    text kind
    jsonb result
  }
  events {
    bigserial id PK
    text type
    text title
    text detail
    text_array audience "roles"
    text outlet_id "store scope"
    text vehicle_id "driver scope"
  }
  app_meta {
    text key PK "schema_version, seeded_at, run_date, clock anchors"
    text value
  }
  demand_history {
    date date PK
    text depot PK
    text brand PK
    numeric total_volume_m3
    numeric chilled_volume_m3
  }
```

## How the data connects

- **One order, one record.** An order is created by the store (or seeded from history) and is the key every role works against: it becomes a `stop` on a `trip` in a published `plan`, gets `proofs` from the driver and a `receipt` from the store. Status on `orders` is the single source the store sees.
- **Plans are versioned.** Regenerating creates a new draft; publishing supersedes the previous version. Loaders see the version they checked against; driver records for a replaced version are kept and flagged.
- **Deferrals are first-class.** Each deferral row records the run it left, the run it moves to, a reason code, the human reason shown to the store and whether it was unavoidable or the dispatcher's choice. `orders.deferred_count` drives fairness in the next plan; the dispatcher overview lists outlets skipped on earlier runs.
- **Fuel quotas are weekly.** Remaining quota = `weekly_fuel_quota_l` − litres in `fuel_ledger` for the ISO week (earlier runs) − fuel of published trips on other days that week.
- **Evidence is append-only.** `proofs` are never updated or deleted by sync; conflicting records are added with `superseded = true` and an `issues` row of kind `sync_conflict`.
- **Notifications are scoped rows.** `events.audience` lists the roles; store, driver and loader events are further filtered by outlet, vehicle and depot in the query.
- **Settings.** `app_meta` holds the schema version, when the data was seeded, the walkthrough run date and the scenario-clock anchor.
- **Reference data = shared datasets.** `outlets`, `vehicles`, `calendar`, `district_travel` and `service_allowance` are loaded from `data/*.csv` with the booklet's column names. `demand_history` is aggregated from `deliveries_train.csv` when present.
