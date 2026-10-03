import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/server/http.ts";
import { query } from "@/server/db.ts";
import { LoginForm } from "@/components/app/login-form";

export const metadata: Metadata = { title: "Sign in · Waypoint" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  const accounts = await query<{
    username: string;
    display_name: string;
    role: string;
    vehicle_id: string | null;
    outlet_id: string | null;
    depot: string | null;
  }>(
    "SELECT username, display_name, role, vehicle_id, outlet_id, depot FROM users WHERE featured ORDER BY id",
  );
  const showDemo = process.env.SHOW_DEMO_ACCOUNTS !== "false";
  return (
    <LoginForm
      accounts={showDemo ? accounts : []}
      demoPassword={
        showDemo ? (process.env.DEMO_PASSWORD ?? "waypoint2026") : ""
      }
    />
  );
}
