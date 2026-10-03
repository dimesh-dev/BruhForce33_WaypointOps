import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vehicle_id = searchParams.get("vehicle_id") || "VEH001";
  const trip_id = (Number(searchParams.get("trip_id")) || 1) as 1 | 2;

  const vehicle = db.getVehicleById(vehicle_id);
  const orders = db.getOrders({ vehicle_id }).filter((o) => o.trip_id === trip_id);
  const sortedStops = [...orders].sort((a, b) => (a.seq_in_route ?? 0) - (b.seq_in_route ?? 0));

  return NextResponse.json({
    success: true,
    vehicle,
    trip_id,
    total_stops: sortedStops.length,
    stops: sortedStops,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      order_id,
      driver_name,
      recipient_name,
      recipient_phone,
      items_received,
      proof_notes,
      signature_svg_or_hash,
      photo_url,
      offline_queued,
    } = body;

    const pod = db.createPodRecord({
      order_id: order_id || "ORD0092301",
      driver_id: "USR-003",
      driver_name: driver_name || "Kasun Perera",
      recipient_name: recipient_name || "Store Team Lead",
      recipient_phone,
      items_received: Number(items_received || 30),
      condition_confirmed: true,
      proof_notes,
      signature_svg_or_hash,
      photo_url,
      offline_queued: Boolean(offline_queued),
    });

    return NextResponse.json({
      success: true,
      message: `Proof of delivery captured for order ${order_id}.`,
      pod,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to record proof of delivery" }, { status: 500 });
  }
}
