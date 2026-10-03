import { body, int, positive, requireUser, route } from "@/server/http.ts";
import { placeOrder } from "@/server/orders.ts";

export const POST = route(async (req) => {
  const user = await requireUser("store_manager");
  const input = await body<Record<string, unknown>>(req);
  return placeOrder(user, {
    temp_requirement:
      input.temp_requirement === "chilled" ? "chilled" : "ambient",
    units: int(input.units, "Units", 1, 5000),
    weight_kg: positive(input.weight_kg, "Weight", 8000),
    volume_m3: positive(input.volume_m3, "Volume", 45),
    notes:
      typeof input.notes === "string" ? input.notes.slice(0, 500) : undefined,
    client_ref:
      typeof input.client_ref === "string"
        ? input.client_ref.slice(0, 80)
        : undefined,
  });
});
