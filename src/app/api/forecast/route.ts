import { requireUser, route } from "@/server/http.ts";
import { capacityForecast } from "@/server/forecast.ts";
import { currentRunDate } from "@/server/views.ts";

export const GET = route(async (req) => {
  await requireUser("dispatcher");
  const params = new URL(req.url).searchParams;
  const weeks = Math.min(12, Math.max(1, Number(params.get("weeks") ?? 8)));
  return capacityForecast(
    params.get("from") ?? (await currentRunDate()),
    weeks,
  );
});
