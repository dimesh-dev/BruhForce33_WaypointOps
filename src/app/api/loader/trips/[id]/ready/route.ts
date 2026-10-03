import { requireUser, route } from "@/server/http.ts";
import { markReady } from "@/server/operations.ts";

export const POST = route(
  async (_req, ctx: RouteContext<"/api/loader/trips/[id]/ready">) => {
    const user = await requireUser("loader");
    const { id } = await ctx.params;
    await markReady(user, Number(id));
    return { ok: true };
  },
);
