import { body, HttpError, int, requireUser, route } from "@/server/http.ts";
import { confirmReceipt } from "@/server/operations.ts";

export const POST = route(
  async (req, ctx: RouteContext<"/api/store/orders/[id]/receipt">) => {
    const user = await requireUser("store_manager");
    const { id } = await ctx.params;
    const input = await body<Record<string, unknown>>(req);
    const condition = input.condition;
    if (
      condition !== "complete" &&
      condition !== "short" &&
      condition !== "damaged"
    )
      throw new HttpError(422, "Choose complete, short or damaged.");
    await confirmReceipt(user, id, {
      units_received: int(input.units_received, "Units received", 0, 10000),
      condition,
      note: typeof input.note === "string" ? input.note.slice(0, 500) : "",
    });
    return { ok: true };
  },
);
