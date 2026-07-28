import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";
import { getAllOrgUnits, getAncestorPath } from "@/lib/org-access";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if (!hasPermission(session, "MANAGE_USERS")) return null;
  return session;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const assignments = await db("RECRUIT_T_UserOrgUnit").where({ userId: id }).select("orgUnitId");
  const units = await getAllOrgUnits();

  const result = assignments.map((a: { orgUnitId: string }) => {
    const path = getAncestorPath(a.orgUnitId, units);
    return {
      orgUnitId: a.orgUnitId,
      name: path.at(-1)?.name ?? a.orgUnitId,
      path: path.map((p) => p.name).join(" / "),
    };
  });

  return NextResponse.json(result);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const user = await db("RECRUIT_T_User").where({ id }).first();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { orgUnitIds } = await req.json();
  if (!Array.isArray(orgUnitIds)) return NextResponse.json({ error: "orgUnitIds must be an array" }, { status: 400 });

  if (orgUnitIds.length > 0) {
    const found = await db("RECRUIT_T_OrgUnit").whereIn("id", orgUnitIds).select("id");
    if (found.length !== new Set(orgUnitIds).size) {
      return NextResponse.json({ error: "One or more org unit ids are invalid" }, { status: 400 });
    }
  }

  // Replace the full assignment set for this user.
  await db("RECRUIT_T_UserOrgUnit").where({ userId: id }).del();
  if (orgUnitIds.length > 0) {
    const now = new Date();
    await db("RECRUIT_T_UserOrgUnit").insert(
      orgUnitIds.map((orgUnitId: string) => ({ id: newId(), userId: id, orgUnitId, createdAt: now }))
    );
  }

  return NextResponse.json({ success: true });
}
