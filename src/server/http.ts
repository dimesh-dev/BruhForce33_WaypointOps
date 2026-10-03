import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSession } from "./passwords.ts";
import { findUser, type Role, type SessionUser } from "./users.ts";
import { PlanError } from "./planning.ts";
import { HttpError } from "./http-error.ts";

export const SESSION_COOKIE = "wp_session";

export { HttpError };

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const session = readSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return (await findUser(session.uid)) ?? null;
}

export async function requireUser(...roles: Role[]): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  if (roles.length && !roles.includes(user.role))
    throw new HttpError(403, "Your role cannot perform this action.");
  return user;
}

/** Wraps a route handler: JSON body parsing, typed errors, consistent error shape. */
export function route<C>(fn: (req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      const result = await fn(req, ctx);
      return result instanceof Response
        ? result
        : NextResponse.json(result ?? { ok: true });
    } catch (error) {
      if (error instanceof HttpError || error instanceof PlanError)
        return NextResponse.json(
          { error: error.message, details: error.details },
          { status: error.status },
        );
      console.error(error);
      return NextResponse.json(
        { error: "Something went wrong on the server." },
        { status: 500 },
      );
    }
  };
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
}

export function str(value: unknown, field: string, max = 500): string {
  if (typeof value !== "string" || !value.trim())
    throw new HttpError(422, `${field} is required.`);
  return value.trim().slice(0, max);
}

export function int(
  value: unknown,
  field: string,
  min = 0,
  max = 100000,
): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new HttpError(
      422,
      `${field} must be a whole number between ${min} and ${max}.`,
    );
  return n;
}

export function positive(value: unknown, field: string, max = 100000): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > max)
    throw new HttpError(422, `${field} must be a positive number.`);
  return n;
}
