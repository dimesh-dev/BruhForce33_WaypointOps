import { requireUser, route } from "@/server/http.ts";
import { publishPlan } from "@/server/planning.ts";

export const POST = route(
  async (_req, ctx: RouteContext<"/api/plans/[id]/publish">) => {
    const user = await requireUser("dispatcher");
    const { id } = await ctx.params;
    return publishPlan(Number(id), user.id);
  },
);
