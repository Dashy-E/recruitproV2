import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission, ApprovalLevel } from "@/lib/permissions";
import { computeInitialMrfState, insertAutoApprovalRecords } from "@/lib/mrf-approval";
import { generateMRFNumber } from "@/lib/mrf-number";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_MRF")) {
    return NextResponse.json({ error: "Only users with MRF management permission can restart approval" }, { status: 403 });
  }

  const { id } = await params;

  const mrf = await db("RECRUIT_T_MRF").where({ id }).select("id", "status", "createdById").first();
  if (!mrf) return NextResponse.json({ error: "MRF not found" }, { status: 404 });

  if (mrf.status !== "REJECTED") {
    return NextResponse.json({ error: "Only rejected MRFs can be restarted" }, { status: 400 });
  }

  // Hierarchy-based self-approval skip re-applies on restart, using the
  // creator's CURRENT role (not a snapshot from creation time) — same rule
  // used at creation, see computeInitialMrfState in src/lib/mrf-approval.ts.
  const creator = await db("RECRUIT_T_User as u")
    .join("RECRUIT_T_Role as r", "r.key", "u.role")
    .where("u.id", mrf.createdById)
    .select("u.name", "u.role", "r.approvalLevel")
    .first();

  const { status: newStatus, skippedStages } = computeInitialMrfState((creator?.approvalLevel ?? null) as ApprovalLevel | null);
  const isImmediatelyApproved = newStatus === "APPROVED";
  const assignedMrfNumber = isImmediatelyApproved ? await generateMRFNumber() : null;

  const now = new Date();

  await db.transaction(async (trx) => {
    // Clear all approval records for this MRF so the chain starts fresh
    await trx("RECRUIT_T_MRFApprovalRecord").where({ mrfId: id }).del();

    // Reset to the hierarchy-appropriate starting stage, clear rejection fields
    await trx("RECRUIT_T_MRF")
      .where({ id })
      .update({
        status: newStatus,
        rejectedAt: null,
        rejectionReason: null,
        approvedAt: isImmediatelyApproved ? now : null,
        ...(isImmediatelyApproved ? { mrfNumber: assignedMrfNumber } : {}),
        updatedAt: now,
      });

    if (creator) {
      await insertAutoApprovalRecords(trx, id, skippedStages, {
        id: mrf.createdById,
        name: creator.name,
        role: creator.role,
      });
    }
  });

  return NextResponse.json({ success: true });
}
