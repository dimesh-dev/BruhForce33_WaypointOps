import { requireUser, route } from "@/server/http.ts";
import { currentRunDate, loaderView } from "@/server/views.ts";

export const GET = route(async (req) => {
  const user = await requireUser("loader");
  const date =
    new URL(req.url).searchParams.get("date") ?? (await currentRunDate());
  return loaderView(user, date);
});
