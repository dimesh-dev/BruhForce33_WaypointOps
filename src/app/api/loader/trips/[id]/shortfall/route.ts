import { body, int, requireUser, route, str } from "@/server/http.ts";
import { reportShortfall } from "@/server/operations.ts";

export const POST = route(
  async (req, ctx: RouteContext<"/api/loader/trips/[id]/shortfall">) => {
    const user = await requireUser("loader");
    const { id } = await ctx.params;
    const input = await body<Record<string, unknown>>(req);
    return reportShortfall(user, Number(id), {
      order_id: str(input.order_id, "Order", 40),
      category: str(input.category, "Shortfall type", 60),
      units_affected: int(input.units_affected, "Units affected", 1, 5000),
      description: str(input.description, "Description", 500),
    });
  },
);
