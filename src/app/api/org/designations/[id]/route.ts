import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_ORG")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const mrfCount = await db("RECRUIT_T_MRF")
      .where({ designationId: id })
      .count<{ count: string }[]>("* as count")
      .then((r) => Number(r[0].count));
    if (mrfCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${mrfCount} MRF(s) reference this designation.` },
        { status: 409 }
      );
    }

    await db("RECRUIT_T_Designation").where({ id }).del();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
