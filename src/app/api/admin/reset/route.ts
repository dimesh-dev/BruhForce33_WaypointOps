import { HttpError, requireUser, route } from "@/server/http.ts";
import { bootstrap } from "@/server/seed.ts";

/** Restores the seeded walkthrough day. Dispatcher only; disable with ALLOW_RESET=false. */
export const POST = route(async () => {
  await requireUser("dispatcher");
  if (process.env.ALLOW_RESET === "false")
    throw new HttpError(403, "Reset is disabled on this deployment.");
  await bootstrap({ force: true });
  return { ok: true };
});
