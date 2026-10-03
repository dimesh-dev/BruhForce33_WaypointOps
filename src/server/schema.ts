/**
 * Database schema. Applied idempotently by `migrate()` on every start.
 * Reference tables mirror the shared CSV columns; operational tables hold the
 * order -> plan -> trip -> stop lifecycle and its audit trail.
 */
export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS app_meta (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- ------------------------------------------------------------ reference data
CREATE TABLE IF NOT EXISTS district_travel (
  district text PRIMARY KEY,
  depot text NOT NULL,
  road_class text NOT NULL,
  free_flow_kmh numeric NOT NULL,
  depot_to_district_km numeric NOT NULL,
  depot_to_district_freeflow_min numeric NOT NULL,
  inter_stop_km numeric NOT NULL,
  inter_stop_freeflow_min numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS service_allowance (
  brand text NOT NULL,
  dock_type text NOT NULL,
  service_allowance_min numeric NOT NULL,
  PRIMARY KEY (brand, dock_type)
);

CREATE TABLE IF NOT EXISTS outlets (
  outlet_id text PRIMARY KEY,
  name text NOT NULL,
  brand text NOT NULL CHECK (brand IN ('Fresh','Style','Tech')),
  district text NOT NULL REFERENCES district_travel(district),
  depot text NOT NULL,
  dock_type text NOT NULL CHECK (dock_type IN ('rear_dock','street','mall_bay')),
  parking_constraint text NOT NULL CHECK (parking_constraint IN ('normal','van_only','mall_dock')),
  mall_window text,
  window_open_time text NOT NULL,
  window_close_time text NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('truck','van')),
  temp text NOT NULL CHECK (temp IN ('reefer','ambient')),
  weight_cap_kg numeric NOT NULL,
  volume_cap_m3 numeric NOT NULL,
  fuel_type text NOT NULL,
  km_per_l numeric NOT NULL,
  weekly_fuel_quota_l numeric NOT NULL,
  depot text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_workshop')),
  driver_name text
);

CREATE TABLE IF NOT EXISTS calendar (
  date date PRIMARY KEY,
  dow int NOT NULL,
  dow_name text NOT NULL,
  is_weekend int NOT NULL,
  iso_year int NOT NULL,
  iso_week int NOT NULL,
  is_payday int NOT NULL,
  festival text,
  festival_ramp numeric NOT NULL DEFAULT 0,
  is_holiday int NOT NULL,
  monsoon int NOT NULL,
  is_operating int NOT NULL
);

-- ------------------------------------------------------------------- people
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('dispatcher','loader','driver','store_manager')),
  depot text,
  vehicle_id text REFERENCES vehicles(vehicle_id),
  outlet_id text REFERENCES outlets(outlet_id),
  featured boolean NOT NULL DEFAULT false
);

-- --------------------------------------------------------------- operations
CREATE TABLE IF NOT EXISTS run_days (
  run_date date PRIMARY KEY REFERENCES calendar(date),
  cutoff_at timestamptz NOT NULL,
  closed_at timestamptz,
  closed_by int REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS orders (
  order_id text PRIMARY KEY,
  outlet_id text NOT NULL REFERENCES outlets(outlet_id),
  brand text NOT NULL,
  district text NOT NULL,
  depot text NOT NULL,
  requested_date date NOT NULL,
  run_date date NOT NULL,
  temp_requirement text NOT NULL CHECK (temp_requirement IN ('chilled','ambient')),
  units int NOT NULL CHECK (units > 0),
  weight_kg numeric NOT NULL CHECK (weight_kg > 0),
  volume_m3 numeric NOT NULL CHECK (volume_m3 > 0),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN
    ('confirmed','planned','deferred','loaded','in_transit','delivered','failed','received','disputed')),
  notes text,
  placed_by int REFERENCES users(id),
  placed_at timestamptz NOT NULL DEFAULT now(),
  client_ref text UNIQUE,
  deferred_count int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS orders_run_date_idx ON orders(run_date);
CREATE INDEX IF NOT EXISTS orders_outlet_idx ON orders(outlet_id);

CREATE TABLE IF NOT EXISTS plans (
  id serial PRIMARY KEY,
  run_date date NOT NULL REFERENCES calendar(date),
  version int NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','published','superseded')),
  summary jsonb NOT NULL,
  created_by int REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (run_date, version)
);

CREATE TABLE IF NOT EXISTS trips (
  id serial PRIMARY KEY,
  plan_id int NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  vehicle_id text NOT NULL REFERENCES vehicles(vehicle_id),
  trip_no int NOT NULL CHECK (trip_no IN (1,2)),
  brand text NOT NULL,
  district text NOT NULL,
  depot text NOT NULL,
  depart_min int NOT NULL,
  return_min int NOT NULL,
  trip_minutes int NOT NULL,
  weight_kg numeric NOT NULL,
  volume_m3 numeric NOT NULL,
  distance_km numeric NOT NULL,
  fuel_l numeric NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN
    ('planned','loading','blocked','ready','in_transit','completed')),
  ready_at timestamptz,
  departed_at timestamptz,
  completed_at timestamptz,
  UNIQUE (plan_id, vehicle_id, trip_no)
);

CREATE TABLE IF NOT EXISTS stops (
  id serial PRIMARY KEY,
  trip_id int NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  order_id text NOT NULL REFERENCES orders(order_id),
  seq int NOT NULL,
  arrival_min int NOT NULL,
  service_start_min int NOT NULL,
  depart_min int NOT NULL,
  window_open_min int NOT NULL,
  window_close_min int NOT NULL,
  service_min int NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','arrived','delivered','failed')),
  loaded boolean NOT NULL DEFAULT false,
  loaded_at timestamptz,
  loaded_by int REFERENCES users(id),
  arrived_at timestamptz,
  completed_at timestamptz,
  UNIQUE (trip_id, seq)
);
CREATE INDEX IF NOT EXISTS stops_order_idx ON stops(order_id);

-- Proof of delivery. Append-only: a sync conflict keeps both records.
CREATE TABLE IF NOT EXISTS proofs (
  id serial PRIMARY KEY,
  stop_id int NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  order_id text NOT NULL REFERENCES orders(order_id),
  outcome text NOT NULL CHECK (outcome IN ('delivered','partial','failed')),
  receiver_name text,
  units_delivered int,
  note text,
  failure_reason text,
  photo text,
  signature text,
  recorded_at timestamptz NOT NULL,
  recorded_by int REFERENCES users(id),
  device_id text,
  client_event_id text UNIQUE,
  received_at timestamptz NOT NULL DEFAULT now(),
  superseded boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS deferrals (
  id serial PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(order_id),
  plan_id int REFERENCES plans(id) ON DELETE CASCADE,
  from_date date NOT NULL,
  to_date date NOT NULL,
  code text NOT NULL,
  reason text NOT NULL,
  unavoidable boolean NOT NULL,
  decided_by int REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deferrals_order_idx ON deferrals(order_id);

CREATE TABLE IF NOT EXISTS issues (
  id serial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('loading_shortfall','delivery_issue','receipt_issue','sync_conflict')),
  category text NOT NULL,
  order_id text REFERENCES orders(order_id),
  trip_id int REFERENCES trips(id) ON DELETE CASCADE,
  outlet_id text REFERENCES outlets(outlet_id),
  units_affected int,
  description text NOT NULL,
  blocks_departure boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution text,
  reported_by int REFERENCES users(id),
  resolved_by int REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  client_event_id text UNIQUE
);

CREATE TABLE IF NOT EXISTS receipts (
  order_id text PRIMARY KEY REFERENCES orders(order_id),
  units_received int NOT NULL,
  condition text NOT NULL CHECK (condition IN ('complete','short','damaged')),
  note text,
  confirmed_by int REFERENCES users(id),
  confirmed_at timestamptz NOT NULL DEFAULT now()
);

-- Fuel already used this ISO week before the planned run (from earlier runs).
CREATE TABLE IF NOT EXISTS fuel_ledger (
  id serial PRIMARY KEY,
  vehicle_id text NOT NULL REFERENCES vehicles(vehicle_id),
  run_date date NOT NULL,
  iso_year int NOT NULL,
  iso_week int NOT NULL,
  litres numeric NOT NULL,
  source text NOT NULL
);
CREATE INDEX IF NOT EXISTS fuel_ledger_week_idx ON fuel_ledger(iso_year, iso_week);

-- Daily demand history (for the capacity forecast).
CREATE TABLE IF NOT EXISTS demand_history (
  date date NOT NULL,
  depot text NOT NULL,
  brand text NOT NULL,
  orders int NOT NULL,
  total_volume_m3 numeric NOT NULL,
  chilled_volume_m3 numeric NOT NULL,
  PRIMARY KEY (date, depot, brand)
);

-- Activity feed and notifications, scoped by audience.
CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  type text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','critical')),
  actor_id int REFERENCES users(id),
  order_id text,
  trip_id int,
  outlet_id text,
  vehicle_id text,
  depot text,
  audience text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_created_idx ON events(created_at DESC);

-- Idempotency record for offline sync batches.
CREATE TABLE IF NOT EXISTS sync_events (
  client_event_id text PRIMARY KEY,
  user_id int REFERENCES users(id),
  device_id text,
  kind text NOT NULL,
  result jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
`;
