import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

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
  const { name, code, locationType } = body;

  const country = await db("RECRUIT_T_Country").where({ id }).first();
  if (!country) return NextResponse.json({ error: "Country not found" }, { status: 404 });

  const [updated] = await db("RECRUIT_T_Country")
    .where({ id })
    .update({
      ...(name && { name }),
      ...(code && { code: code.toUpperCase() }),
      ...(locationType && { locationType }),
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

  // Block deletion if any branches, MRFs, or users are linked
  const [branchCount, mrfCount, userCount] = await Promise.all([
    db("RECRUIT_T_Branch").where({ countryId: id }).count<{ count: string }[]>("* as count").then((r) => Number(r[0].count)),
    db("RECRUIT_T_MRF").where({ countryId: id }).count<{ count: string }[]>("* as count").then((r) => Number(r[0].count)),
    db("RECRUIT_T_User").where({ countryId: id }).count<{ count: string }[]>("* as count").then((r) => Number(r[0].count)),
  ]);

  if (branchCount + mrfCount + userCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: country has ${branchCount} branch(es), ${mrfCount} MRF(s), and ${userCount} user(s) linked to it.`,
        counts: { branchCount, mrfCount, userCount },
      },
      { status: 409 }
    );
  }

  await db("RECRUIT_T_Country").where({ id }).del();
  return NextResponse.json({ success: true });
}
