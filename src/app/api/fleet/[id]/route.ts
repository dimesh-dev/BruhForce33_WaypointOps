import { query } from "@/server/db.ts";
import { emit } from "@/server/events.ts";
import { body, HttpError, requireUser, route } from "@/server/http.ts";

/** Mark a vehicle available or in the workshop. Takes effect on the next generated plan. */
export const PATCH = route(
  async (req, ctx: RouteContext<"/api/fleet/[id]">) => {
    const user = await requireUser("dispatcher");
    const { id } = await ctx.params;
    const input = await body<{ status?: string }>(req);
    if (input.status !== "available" && input.status !== "in_workshop")
      throw new HttpError(422, "Status must be available or in_workshop.");
    const rows = await query(
      "UPDATE vehicles SET status = $2 WHERE vehicle_id = $1 RETURNING vehicle_id",
      [id, input.status],
    );
    if (!rows.length) throw new HttpError(404, "Vehicle not found.");
    await emit({
      type: "fleet.status",
      title: `${id} ${input.status === "available" ? "back in service" : "sent to the workshop"}`,
      detail: "Regenerate the draft plan to use the updated fleet.",
      actor_id: user.id,
      vehicle_id: id,
      audience: ["dispatcher"],
    });
    return { ok: true };
  },
);
