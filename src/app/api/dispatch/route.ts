import { requireUser, route } from "@/server/http.ts";
import { currentRunDate, dispatcherBoard } from "@/server/views.ts";

export const GET = route(async (req) => {
  await requireUser("dispatcher");
  const date =
    new URL(req.url).searchParams.get("date") ?? (await currentRunDate());
  return dispatcherBoard(date);
});
