import { body, requireUser, route, str } from "@/server/http.ts";
import { generatePlan } from "@/server/planning.ts";

/** Generate (or regenerate) the draft plan for a run with the allocation engine. */
export const POST = route(async (req) => {
  const user = await requireUser("dispatcher");
  const input = await body<{ run_date?: string }>(req);
  return generatePlan(str(input.run_date, "Run date", 10), user.id);
});
