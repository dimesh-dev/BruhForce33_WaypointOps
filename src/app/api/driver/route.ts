import { requireUser, route } from "@/server/http.ts";
import { driverView } from "@/server/views.ts";

export const GET = route(async () => driverView(await requireUser("driver")));
