import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = db.getOrderById(id);

  if (!order) {
    return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
  }

  const outlet = db.getOutletById(order.outlet_id);
  const vehicle = order.vehicle_id ? db.getVehicleById(order.vehicle_id) : undefined;
  const pod = db.getPodRecords(order.order_id);

  return NextResponse.json({
    success: true,
    order,
    outlet,
    vehicle,
    pod,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = db.updateOrder(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to update order" }, { status: 500 });
  }
}
