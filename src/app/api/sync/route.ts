import { body, HttpError, requireUser, route } from "@/server/http.ts";
import { syncEvents, type FieldEvent } from "@/server/sync.ts";

const KINDS = new Set([
  "trip.depart",
  "stop.arrive",
  "stop.deliver",
  "stop.fail",
  "issue.report",
]);

/** Receives a batch of driver field events recorded online or offline. */
export const POST = route(async (req) => {
  const user = await requireUser("driver");
  const input = await body<{ events?: FieldEvent[] }>(req);
  if (!Array.isArray(input.events) || input.events.length > 200)
    throw new HttpError(422, "Send between 1 and 200 events.");
  for (const e of input.events)
    if (
      typeof e?.client_event_id !== "string" ||
      !KINDS.has(e.kind) ||
      typeof e.recorded_at !== "string"
    )
      throw new HttpError(
        422,
        "Each event needs client_event_id, a known kind and recorded_at.",
      );
  return { results: await syncEvents(user, input.events) };
});
