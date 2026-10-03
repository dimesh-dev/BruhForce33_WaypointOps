import { one } from "@/server/db.ts";
import { route } from "@/server/http.ts";

export const GET = route(async () => {
  const meta = await one<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'seeded_at'",
  );
  return { ok: true, seeded_at: meta?.value ?? null };
});
