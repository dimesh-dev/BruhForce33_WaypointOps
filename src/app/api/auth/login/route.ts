import { cookies } from "next/headers";
import { one } from "@/server/db.ts";
import { signSession, verifyPassword } from "@/server/passwords.ts";
import { body, HttpError, route, SESSION_COOKIE, str } from "@/server/http.ts";

const SESSION_HOURS = 12;

export const POST = route(async (req) => {
  const input = await body<{ username?: string; password?: string }>(req);
  const username = str(input.username, "Username", 80).toLowerCase();
  const password = str(input.password, "Password", 200);
  const user = await one<{
    id: number;
    password_hash: string;
    role: string;
    display_name: string;
  }>(
    "SELECT id, password_hash, role, display_name FROM users WHERE username = $1",
    [username],
  );
  if (!user || !verifyPassword(password, user.password_hash))
    throw new HttpError(401, "That username and password do not match.");
  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    signSession({ uid: user.id, exp: Date.now() + SESSION_HOURS * 3600_000 }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      path: "/",
      maxAge: SESSION_HOURS * 3600,
    },
  );
  return { role: user.role, display_name: user.display_name };
});
