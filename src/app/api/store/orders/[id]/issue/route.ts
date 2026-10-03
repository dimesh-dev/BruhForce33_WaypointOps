import { body, requireUser, route, str } from "@/server/http.ts";
import { reportStoreIssue } from "@/server/operations.ts";

export const POST = route(
  async (req, ctx: RouteContext<"/api/store/orders/[id]/issue">) => {
    const user = await requireUser("store_manager");
    const { id } = await ctx.params;
    const input = await body<Record<string, unknown>>(req);
    await reportStoreIssue(
      user,
      id,
      str(input.category, "Issue type", 60),
      str(input.description, "Description", 500),
    );
    return { ok: true };
  },
);
