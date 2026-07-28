import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { fromBool } from "@/lib/db-bool";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if (!hasPermission(session, "MANAGE_ORG")) return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, parentId, sortOrder, isActive } = body;

  const unit = await db("RECRUIT_T_OrgUnit").where({ id }).first();
  if (!unit) return NextResponse.json({ error: "Org unit not found" }, { status: 404 });

  if (parentId) {
    if (parentId === id) return NextResponse.json({ error: "A node cannot be its own parent" }, { status: 400 });
    const parent = await db("RECRUIT_T_OrgUnit").where({ id: parentId }).first();
    if (!parent) return NextResponse.json({ error: "Parent org unit not found" }, { status: 404 });
  }

  const [updated] = await db("RECRUIT_T_OrgUnit")
    .where({ id })
    .update({
      ...(name && { name }),
      ...(parentId !== undefined && { parentId: parentId || null }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive: isActive ? 1 : 0 }),
      updatedAt: new Date(),
    })
    .returning("*");

  return NextResponse.json({ ...updated, isActive: fromBool(updated.isActive) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const [childCount, mrfCount, userCount] = await Promise.all([
    db("RECRUIT_T_OrgUnit").where({ parentId: id }).count<{ count: string }[]>("* as count").then((r) => Number(r[0].count)),
    db("RECRUIT_T_MRF").where({ orgUnitId: id }).count<{ count: string }[]>("* as count").then((r) => Number(r[0].count)),
    db("RECRUIT_T_UserOrgUnit").where({ orgUnitId: id }).count<{ count: string }[]>("* as count").then((r) => Number(r[0].count)),
  ]);

  if (childCount + mrfCount + userCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: this node has ${childCount} child unit(s), ${mrfCount} MRF(s), and ${userCount} user assignment(s) linked to it.`,
        counts: { childCount, mrfCount, userCount },
      },
      { status: 409 }
    );
  }

  await db("RECRUIT_T_OrgUnit").where({ id }).del();
  return NextResponse.json({ success: true });
}
