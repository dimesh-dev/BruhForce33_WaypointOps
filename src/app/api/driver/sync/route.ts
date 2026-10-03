import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const queuedItems: any[] = Array.isArray(body) ? body : body.queue || [];

    if (queuedItems.length === 0) {
      return NextResponse.json({
        success: true,
        synced_count: 0,
        message: "No queued offline records to synchronize.",
      });
    }

    const synced = db.syncPodQueue(
      queuedItems.map((q) => ({
        order_id: q.id || q.order_id,
        driver_id: q.driver_id || "USR-003",
        driver_name: q.driver_name || "Kasun Perera",
        recipient_name: q.recipient_name || q.receiver || "Receiving Staff",
        items_received: Number(q.count || q.items_received || 30),
        condition_confirmed: true,
        proof_notes: q.proof || q.proof_notes || "Captured during offline mode.",
        signature_svg_or_hash: q.signature || undefined,
        photo_url: q.photo_url || undefined,
      }))
    );

    return NextResponse.json({
      success: true,
      synced_count: synced.length,
      message: `Successfully synchronized ${synced.length} offline delivery record(s) to central database.`,
      records: synced,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to synchronize offline queue" }, { status: 500 });
  }
}
