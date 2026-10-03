import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  const resetStore = db.resetToSeedData();
  return NextResponse.json({
    success: true,
    message: "Waypoint system successfully re-seeded with official datasets and realistic dispatch day.",
    stats: {
      outlets: resetStore.outlets.length,
      vehicles: resetStore.vehicles.length,
      users: resetStore.users.length,
      orders: resetStore.orders.length,
    },
  });
}
