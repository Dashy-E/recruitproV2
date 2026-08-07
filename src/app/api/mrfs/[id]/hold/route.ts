import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { toBool } from "@/lib/db-bool";
import { ApprovalLevel } from "@/lib/permissions";
import { isDesignatedApproverForStage } from "@/lib/mrf-approval";

async function canHold(session: any, mrf: { status: string; orgUnitId: string; departmentId: string }) {
  const approvalLevel = (session.user as { approvalLevel?: ApprovalLevel | null })?.approvalLevel ?? null;
  const userId = (session.user as { id?: string })?.id!;
  if (approvalLevel === "ANY") return true;
  return isDesignatedApproverForStage(userId, approvalLevel, mrf);
}

// Puts an MRF "on hold" — pauses the every-3-days reminder email/notification
// to the current stage's approver(s) (see src/lib/mrf-reminders.ts) without
// blocking Approve/Reject, which stays available the whole time. Authorized
// the same way as Approve/Reject: the genuinely designated approver for this
// MRF's current stage, or a universal (ANY) approver.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mrf = await db("RECRUIT_T_MRF").where({ id }).select("id", "status", "orgUnitId", "departmentId").first();
  if (!mrf) return NextResponse.json({ error: "MRF not found" }, { status: 404 });

  if (!(await canHold(session, mrf))) {
    return NextResponse.json({ error: "You are not authorized to hold this MRF" }, { status: 403 });
  }

  const { durationDays, indefinite } = await req.json();
  const userId = (session.user as { id?: string })?.id!;
  const now = new Date();

  if (indefinite) {
    await db("RECRUIT_T_MRF").where({ id }).update({
      holdIndefinite: toBool(true),
      holdUntil: null,
      heldById: userId,
      heldAt: now,
      updatedAt: now,
    });
  } else if (typeof durationDays === "number" && durationDays > 0) {
    const holdUntil = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    await db("RECRUIT_T_MRF").where({ id }).update({
      holdIndefinite: toBool(false),
      holdUntil,
      heldById: userId,
      heldAt: now,
      updatedAt: now,
    });
  } else {
    return NextResponse.json({ error: "durationDays (positive number) or indefinite is required" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

// Releases an active hold, resuming reminders immediately.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mrf = await db("RECRUIT_T_MRF").where({ id }).select("id", "status", "orgUnitId", "departmentId").first();
  if (!mrf) return NextResponse.json({ error: "MRF not found" }, { status: 404 });

  if (!(await canHold(session, mrf))) {
    return NextResponse.json({ error: "You are not authorized to release this hold" }, { status: 403 });
  }

  await db("RECRUIT_T_MRF").where({ id }).update({
    holdIndefinite: toBool(false),
    holdUntil: null,
    heldById: null,
    heldAt: null,
    updatedAt: new Date(),
  });

  return NextResponse.json({ success: true });
}
