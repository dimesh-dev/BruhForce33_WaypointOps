import { query } from "@/server/db.ts";
import { HttpError, requireUser, route } from "@/server/http.ts";

/** Every proof recorded for an order, including superseded and conflicting ones. */
export const GET = route(
  async (_req, ctx: RouteContext<"/api/proofs/[orderId]">) => {
    const user = await requireUser("dispatcher", "store_manager");
    const { orderId } = await ctx.params;
    if (user.role === "store_manager") {
      const own = await query(
        "SELECT 1 FROM orders WHERE order_id = $1 AND outlet_id = $2",
        [orderId, user.outlet_id],
      );
      if (!own.length)
        throw new HttpError(404, "Order not found for your store.");
    }
    const proofs = await query(
      `SELECT p.id, p.outcome, p.receiver_name, p.units_delivered, p.note, p.failure_reason, p.photo, p.signature,
            p.recorded_at, p.received_at, p.device_id, p.superseded, u.display_name AS recorded_by
       FROM proofs p LEFT JOIN users u ON u.id = p.recorded_by WHERE p.order_id = $1 ORDER BY p.recorded_at`,
      [orderId],
    );
    return { proofs };
  },
);
