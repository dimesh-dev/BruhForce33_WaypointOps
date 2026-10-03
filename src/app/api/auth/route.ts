import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const users = db.getUsers();
  return NextResponse.json({
    success: true,
    users,
    seededAccounts: [
      { role: "Dispatcher", email: "amaya@waypoint.lk", name: "Amaya Jayasinghe", depot: "Peliyagoda" },
      { role: "Loader", email: "ruwan@waypoint.lk", name: "Ruwan Kumara", depot: "Peliyagoda" },
      { role: "Driver", email: "kasun@waypoint.lk", name: "Kasun Perera", vehicle_id: "VEH001" },
      { role: "Store manager", email: "anjali@waypoint.lk", name: "Anjali Fernando", outlet_id: "OUT001" },
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, role } = body;

    let user;
    if (email) {
      user = db.getUserByEmail(email);
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
