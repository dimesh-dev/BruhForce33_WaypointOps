import { body, HttpError, requireUser, route, str } from "@/server/http.ts";
import { editPlan, type PlanEdit } from "@/server/planning.ts";

export const POST = route(
  async (req, ctx: RouteContext<"/api/plans/[id]/edit">) => {
    const user = await requireUser("dispatcher");
    const { id } = await ctx.params;
    const input = await body<
      Partial<PlanEdit> & { vehicle_id?: string; reason?: string }
    >(req);
    const orderId = str(input.order_id, "Order", 40);
    let edit: PlanEdit;
    if (input.type === "defer")
      edit = {
        type: "defer",
        order_id: orderId,
        reason: str(input.reason, "Reason", 300),
      };
    else if (input.type === "assign")
      edit = {
        type: "assign",
        order_id: orderId,
        vehicle_id: str(input.vehicle_id, "Vehicle", 20),
      };
    else throw new HttpError(422, "Edit type must be assign or defer.");
    return editPlan(Number(id), edit, user.id);
  },
);
