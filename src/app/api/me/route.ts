import { requireUser, route } from "@/server/http.ts";
import { clockInfo, currentRunDate } from "@/server/views.ts";

export const GET = route(async () => {
  const user = await requireUser();
  return { user, run_date: await currentRunDate(), clock: await clockInfo() };
});
