import { body, requireUser, route } from "@/server/http.ts";
import { setLoaded } from "@/server/operations.ts";

export const POST = route(
  async (req, ctx: RouteContext<"/api/loader/stops/[id]">) => {
    const user = await requireUser("loader");
    const { id } = await ctx.params;
    const input = await body<{ loaded?: boolean }>(req);
    await setLoaded(user, Number(id), input.loaded === true);
    return { ok: true };
  },
);
