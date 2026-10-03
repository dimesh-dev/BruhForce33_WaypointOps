import { requireUser, route } from "@/server/http.ts";
import { outletsView } from "@/server/views.ts";

export const GET = route(async () => {
  await requireUser("dispatcher");
  return { outlets: await outletsView() };
});
