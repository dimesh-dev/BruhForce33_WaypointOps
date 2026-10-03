import { body, HttpError, requireUser, route, str } from "@/server/http.ts";
import { resolveIssue } from "@/server/operations.ts";

export const POST = route(
  async (req, ctx: RouteContext<"/api/issues/[id]/resolve">) => {
    const user = await requireUser("dispatcher");
    const { id } = await ctx.params;
    const input = await body<{ action?: string; note?: string }>(req);
    if (input.action !== "proceed" && input.action !== "remove_order")
      throw new HttpError(422, "Choose proceed or remove_order.");
    await resolveIssue(user, Number(id), {
      action: input.action,
      note: str(input.note, "Decision note", 500),
    });
    return { ok: true };
  },
);
