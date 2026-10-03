import { requireUser, route } from "@/server/http.ts";
import { eventsFor } from "@/server/events.ts";

export const GET = route(async (req) => {
  const user = await requireUser();
  const since = Number(new URL(req.url).searchParams.get("since") ?? 0);
  return { events: await eventsFor(user, Number.isFinite(since) ? since : 0) };
});
