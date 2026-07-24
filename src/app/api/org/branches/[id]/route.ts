import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_ORG")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, code, stateId, divisionId, countryId } = body;

  const branch = await db("RECRUIT_T_Branch").where({ id }).first();
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  const [updated] = await db("RECRUIT_T_Branch")
    .where({ id })
    .update({
      ...(name !== undefined && { name }),
      ...(code !== undefined && { code: code.toUpperCase() }),
      ...(stateId !== undefined && { stateId: stateId || null }),
      ...(divisionId !== undefined && { divisionId: divisionId || null }),
      ...(countryId !== undefined && { countryId }),
      updatedAt: new Date(),
    })
    .returning("*");

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_ORG")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const [userCount, mrfCount] = await Promise.all([
    db("RECRUIT_T_User").where({ branchId: id }).count<{ count: string }[]>("* as count").then((r) => Number(r[0].count)),
    db("RECRUIT_T_MRF").where({ branchId: id }).count<{ count: string }[]>("* as count").then((r) => Number(r[0].count)),
  ]);

  if (userCount + mrfCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${userCount} user(s) and ${mrfCount} MRF(s) reference this branch.` },
      { status: 409 }
    );
  }

  await db("RECRUIT_T_Branch").where({ id }).del();
  return NextResponse.json({ success: true });
}
