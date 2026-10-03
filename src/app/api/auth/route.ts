import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const users = db.getUsers();
  return NextResponse.json({
    success: true,
    users,
    seededAccounts: [
      { role: "Dispatcher", email: "dispatcher@waypoint.lk", alias: "amaya@waypoint.lk", name: "Amaya Jayasinghe", depot: "Peliyagoda" },
      { role: "Loader", email: "loader@waypoint.lk", alias: "ruwan@waypoint.lk", name: "Ruwan Kumara", depot: "Peliyagoda" },
      { role: "Driver", email: "driver@waypoint.lk", alias: "kasun@waypoint.lk", name: "Kasun Perera", vehicle_id: "VEH001" },
      { role: "Store manager", email: "storemanager@waypoint.lk", alias: "anjali@waypoint.lk", name: "Anjali Fernando", outlet_id: "OUT001" },
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, role } = body;

    const emailAliases: Record<string, string> = {
      "dispatcher@waypoint.lk": "amaya@waypoint.lk",
      "loader@waypoint.lk": "ruwan@waypoint.lk",
      "driver@waypoint.lk": "kasun@waypoint.lk",
      "storemanager@waypoint.lk": "anjali@waypoint.lk",
      "store_manager@waypoint.lk": "anjali@waypoint.lk",
    };

    let user;
    const lookupEmail = email ? emailAliases[email.toLowerCase()] || email : undefined;

    if (lookupEmail) {
      user = db.getUserByEmail(lookupEmail);
    } else if (role) {
      user = db.getUsers().find((u) => u.role.toLowerCase() === role.toLowerCase());
    }

    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user,
      token: `waypoint-token-${user.id}-${Date.now()}`,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Authentication failed" }, { status: 500 });
  }
}
