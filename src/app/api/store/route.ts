import { requireUser, route } from "@/server/http.ts";
import { storeView } from "@/server/views.ts";

export const GET = route(async () =>
  storeView(await requireUser("store_manager")),
);
