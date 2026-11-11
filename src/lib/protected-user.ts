import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { db } from "@/lib/db";

// The seeded "System Admin" account is locked: only the user who logged in
// as userName "admin" may change it (details, role, password, status,
// org units, signature). Everyone else — even other ADMINs with
// MANAGE_USERS — gets a 403.
export const PROTECTED_USER_NAME = "System Admin";
export const SUPER_ADMIN_USERNAME = "admin";

export function isProtectedUser(target: { name?: string | null } | null | undefined): boolean {
  return (target?.name ?? "").trim().toLowerCase() === PROTECTED_USER_NAME.toLowerCase();
}

// Returns a 403 response if the session user isn't allowed to modify
// `target`, or null if the edit may proceed. The requester's userName is
// read from the DB (not the session token) so it can't be stale or spoofed.
export async function guardProtectedUser(
  session: Session,
  target: { name?: string | null } | null | undefined
): Promise<NextResponse | null> {
  if (!isProtectedUser(target)) return null;
  const myId = (session.user as { id?: string })?.id;
  const me = myId ? await db("RECRUIT_T_User").where({ id: myId }).select("userName").first() : null;
  if (me?.userName === SUPER_ADMIN_USERNAME) return null;
  return NextResponse.json(
    { error: `Only the "${SUPER_ADMIN_USERNAME}" user can edit ${PROTECTED_USER_NAME}` },
    { status: 403 }
  );
}
