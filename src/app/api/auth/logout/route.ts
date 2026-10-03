import { cookies } from "next/headers";
import { route, SESSION_COOKIE } from "@/server/http.ts";

export const POST = route(async () => {
  (await cookies()).delete(SESSION_COOKIE);
  return { ok: true };
});
