import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vehicle_id = searchParams.get("vehicle_id") || "VEH001";
  const trip_id = (Number(searchParams.get("trip_id")) || 1) as 1 | 2;

  const orders = db.getOrders({ vehicle_id }).filter((o) => o.trip_id === trip_id);
  const loadingLogs = db.getLoadingLogs(vehicle_id, trip_id);

  // Sort orders in reverse delivery sequence for reverse loading (Last stop loaded first)
  const reverseLoadingSequence = [...orders].sort((a, b) => (b.seq_in_route ?? 0) - (a.seq_in_route ?? 0));

  return NextResponse.json({
    success: true,
    vehicle_id,
    trip_id,
    total_stops: orders.length,
    reverseLoadingSequence,
    loadingLogs,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { order_id, vehicle_id, trip_id, status, shortfall_type, shortfall_notes, loader_name } = body;

    const log = db.createLoadingLog({
      order_id: order_id || "ORD0092301",
      vehicle_id: vehicle_id || "VEH001",
      trip_id: trip_id || 1,
      loader_id: "USR-002",
      loader_name: loader_name || "Ruwan Kumara",
      status: status || "loaded",
      shortfall_type,
      shortfall_notes,
    });

    if (shortfall_type) {
      db.updateOrder(order_id, {
        reported_discrepancy: `Loading shortfall: ${shortfall_type}${shortfall_notes ? ` - ${shortfall_notes}` : ""}`,
      });
    }

    return NextResponse.json({
      success: true,
      message: shortfall_type
        ? `Loading shortfall flagged for ${order_id}: ${shortfall_type}`
        : `Order ${order_id} marked as loaded in reverse stop sequence.`,
      log,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to record loading action" }, { status: 500 });
  }
}
