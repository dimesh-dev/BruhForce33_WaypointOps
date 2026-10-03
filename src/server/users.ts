import { one, type Db, pool } from "./db.ts";

export type Role = "dispatcher" | "loader" | "driver" | "store_manager";

export interface SessionUser {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  depot: string | null;
  vehicle_id: string | null;
  outlet_id: string | null;
}

export async function findUser(id: number, db: Db = pool()) {
  return one<SessionUser>(
    "SELECT id, username, display_name, role, depot, vehicle_id, outlet_id FROM users WHERE id = $1",
    [id],
    db,
  );
}
