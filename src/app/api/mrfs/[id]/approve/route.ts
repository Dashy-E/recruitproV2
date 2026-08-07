import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { STATUS_TO_APPROVAL_LEVELS, ApprovalLevel } from "@/lib/permissions";
import { isDesignatedApproverForStage, getEligibleApprovers } from "@/lib/mrf-approval";
import { generateMRFNumber } from "@/lib/mrf-number";
import nodemailer from "nodemailer";

const STATUS_FLOW: Record<string, string> = {
  PENDING_DIVISIONAL: "PENDING_COUNTRY_SUPERVISOR",
  PENDING_COUNTRY_SUPERVISOR: "PENDING_FUNCTIONAL",
  PENDING_FUNCTIONAL: "APPROVED",
};

// Display/grouping label stored on the approval record — represents the
// STAGE, not the specific role that acted (stage 1 accepts either a
// Divisional or a Country Manager; approverRole below records who actually
// approved). Unrelated to the approvalLevel permission enum used for
// authorization below.
const LEVEL_LABEL: Record<string, string> = {
  PENDING_DIVISIONAL: "DIVISIONAL_MANAGER",
  PENDING_COUNTRY_SUPERVISOR: "COUNTRY_SUPERVISOR",
  PENDING_FUNCTIONAL: "FUNCTIONAL_HEAD",
};

async function sendApprovalEmail(toEmail: string, toName: string, referenceNumber: string, mrfTitle: string) {
  if (!process.env.SMTP_HOST) return;
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || "noreply@recruitpro.com",
      to: toEmail,
      subject: `Action Required: MRF ${referenceNumber} awaiting your approval`,
      text: `Dear ${toName},\n\nMRF "${mrfTitle}" (${referenceNumber}) has been forwarded for your approval.\n\nPlease log in to review:\n${process.env.NEXTAUTH_URL}/dashboard/approvals\n\nThank you,\nRecruitPro ERP`,
    });
  } catch { /* SMTP failure is non-fatal */ }
}

async function createNotification(userId: string, title: string, message: string, link: string) {
  try {
    await db("RECRUIT_T_Notification").insert({
      id: newId(),
      userId,
      type: "MRF_APPROVAL",
      title,
      message,
      link,
      isRead: 0,
      createdAt: new Date(),
    });
  } catch { /* notification failure is non-fatal */ }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role || "";
  const approvalLevel = (session.user as { approvalLevel?: ApprovalLevel | null })?.approvalLevel ?? null;
  const userId = (session.user as { id?: string })?.id!;
  const userName = session.user?.name || "Unknown";

  const { id } = await params;
  const body = await req.json();
  const { action, approverName, approverDesignation, notes } = body;

  const mrf = await db("RECRUIT_T_MRF as m")
    .join("RECRUIT_T_User as u", "u.id", "m.createdById")
    .where("m.id", id)
    .select("m.*", "u.name as createdByName")
    .first();
  if (!mrf) return NextResponse.json({ error: "MRF not found" }, { status: 404 });

  if (["APPROVED", "REJECTED", "DRAFT"].includes(mrf.status)) {
    return NextResponse.json({ error: "MRF cannot be updated in current status" }, { status: 400 });
  }

  // "ANY" is a universal approver (matches the old isAdminOrHR / COUNTRY_MANAGER
  // bypass in one rule); otherwise the role's approvalLevel must match the
  // MRF's current pending stage AND the user must have org-unit access to the
  // MRF's location (and, for Functional Head, be the registered head of the
  // MRF's department) — see src/lib/mrf-approval.ts.
  const isUniversalApprover = approvalLevel === "ANY";
  const isManagerForThisLevel = await isDesignatedApproverForStage(userId, approvalLevel, mrf);

  if (!isUniversalApprover && !isManagerForThisLevel) {
    return NextResponse.json({ error: "You are not authorized to approve this MRF at its current stage" }, { status: 403 });
  }

  const resolvedApproverName = (isManagerForThisLevel || isUniversalApprover) ? userName : (approverName || "External Approver");
  const currentLevel = LEVEL_LABEL[mrf.status];
  const now = new Date();
  const recordId = newId();

  if (action === "approve") {
    const nextStatus = STATUS_FLOW[mrf.status];
    const isFinalApproval = nextStatus === "APPROVED";
    const approvedAt = isFinalApproval ? now : null;
    // Reference number is assigned exactly once, right here, the moment the
    // MRF clears its last approval stage — never at creation.
    const assignedMrfNumber = isFinalApproval ? await generateMRFNumber() : null;

    await db.transaction(async (trx) => {
      await trx("RECRUIT_T_MRFApprovalRecord").insert({
        id: recordId,
        mrfId: id,
        level: currentLevel,
        approverRole: role,
        approverName: resolvedApproverName,
        approverDesignation: approverDesignation || null,
        approverId: isManagerForThisLevel ? userId : null,
        status: "APPROVED",
        notes: notes || null,
        recordedById: userId,
        recordedAt: now,
      });

      await trx("RECRUIT_T_MRF")
        .where({ id })
        .update({
          status: nextStatus,
          updatedAt: now,
          ...(approvedAt ? { approvedAt } : {}),
          ...(assignedMrfNumber ? { mrfNumber: assignedMrfNumber } : {}),
          // A hold belongs to whoever placed it at the stage they were
          // deciding on — once that stage clears, a different person is
          // responsible next, so any leftover hold shouldn't silently mute
          // their reminders too. The stage-1 notification below resets the
          // 3-day reminder clock for the new stage's approver(s).
          ...(!isFinalApproval
            ? { lastReminderSentAt: now, holdUntil: null, holdIndefinite: 0, heldById: null, heldAt: null }
            : {}),
        });
    });

    // Notifications and emails are non-fatal — DB changes above are already committed
    try {
      if (nextStatus !== "APPROVED") {
        // Notify every active user eligible to act at the next stage — same
        // org/department eligibility rules as the authorization check above.
        const recipients = await getEligibleApprovers(mrf, STATUS_TO_APPROVAL_LEVELS[nextStatus] || []);

        await Promise.all(recipients.map(async (approver: any) => {
          await createNotification(
            approver.id,
            `MRF ${mrf.referenceNumber} awaiting your approval`,
            `"${mrf.title}" has been approved at ${currentLevel.replace(/_/g, " ")} level and requires your review.`,
            `/dashboard/approvals`
          );
          await sendApprovalEmail(approver.email, approver.name, mrf.referenceNumber, mrf.title);
        }));
      } else {
        await createNotification(
          mrf.createdById,
          `MRF ${mrf.referenceNumber} approved`,
          `Your MRF "${mrf.title}" (${mrf.referenceNumber}) has been fully approved and assigned MRF number ${assignedMrfNumber}.`,
          `/dashboard/mrfs/${id}`
        );
      }
    } catch { /* notification/email failure is non-fatal */ }

  } else if (action === "reject") {
    await db.transaction(async (trx) => {
      await trx("RECRUIT_T_MRFApprovalRecord").insert({
        id: recordId,
        mrfId: id,
        level: currentLevel,
        approverRole: role,
        approverName: resolvedApproverName,
        approverDesignation: approverDesignation || null,
        approverId: isManagerForThisLevel ? userId : null,
        status: "REJECTED",
        notes: notes || null,
        recordedById: userId,
        recordedAt: now,
      });

      await trx("RECRUIT_T_MRF")
        .where({ id })
        .update({
          status: "REJECTED",
          rejectedAt: now,
          rejectionReason: notes || null,
          updatedAt: now,
        });
    });

    // Notify MRF creator
    await createNotification(
      mrf.createdById,
      `MRF ${mrf.referenceNumber} was rejected`,
      `"${mrf.title}" was rejected by ${resolvedApproverName}${notes ? `: ${notes}` : "."}`,
      `/dashboard/mrfs/${id}`
    );

  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
