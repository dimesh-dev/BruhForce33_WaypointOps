import { body, requireUser, route, str } from "@/server/http.ts";
import { closeQueue } from "@/server/planning.ts";

export const POST = route(async (req) => {
  const user = await requireUser("dispatcher");
  const input = await body<{ run_date?: string }>(req);
  await closeQueue(str(input.run_date, "Run date", 10), user.id);
  return { ok: true };
});
