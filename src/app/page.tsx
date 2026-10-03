import { redirect } from "next/navigation";
import { currentUser } from "@/server/http.ts";
import { WaypointApp } from "@/components/app/waypoint-app";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <WaypointApp user={user} />;
}
