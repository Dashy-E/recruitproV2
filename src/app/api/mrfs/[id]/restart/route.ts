import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_MRF")) {
    return NextResponse.json({ error: "Only users with MRF management permission can restart approval" }, { status: 403 });
  }

  const { id } = await params;

  const mrf = await db("RECRUIT_T_MRF").where({ id }).select("id", "status").first();
  if (!mrf) return NextResponse.json({ error: "MRF not found" }, { status: 404 });

  if (mrf.status !== "REJECTED") {
    return NextResponse.json({ error: "Only rejected MRFs can be restarted" }, { status: 400 });
  }

  const now = new Date();

  await db.transaction(async (trx) => {
    // Clear all approval records for this MRF so the chain starts fresh
    await trx("RECRUIT_T_MRFApprovalRecord").where({ mrfId: id }).del();

    // Reset MRF to PENDING_DIVISIONAL, clear rejection fields
    await trx("RECRUIT_T_MRF")
      .where({ id })
      .update({
        status: "PENDING_DIVISIONAL",
        rejectedAt: null,
        rejectionReason: null,
        approvedAt: null,
        updatedAt: now,
      });
  });

  return NextResponse.json({ success: true });
}
