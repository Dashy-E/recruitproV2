import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { STATUS_TO_APPROVAL_LEVELS, ApprovalLevel, hasPermission } from "@/lib/permissions";
import {
  isDesignatedApproverForStage,
  getEligibleApprovers,
  STATUS_FLOW,
  STAGE_LEVEL_LABEL as LEVEL_LABEL,
} from "@/lib/mrf-approval";
import { generateMRFNumber } from "@/lib/mrf-number";
import nodemailer from "nodemailer";

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
  // MRF's department) — see src/lib/mrf-approval.ts. Skip is a separate,
  // purely permission-based override — it deliberately does NOT require
  // being the designated approver for this stage (e.g. their location's
  // Country Supervisor is unavailable, so someone with SKIP_MRF_APPROVAL
  // pushes it to the next stage instead).
  const isUniversalApprover = approvalLevel === "ANY";
  let isManagerForThisLevel = false;

  if (action === "skip") {
    if (!hasPermission(session, "SKIP_MRF_APPROVAL")) {
      return NextResponse.json({ error: "You do not have permission to skip approval levels" }, { status: 403 });
    }
  } else {
    isManagerForThisLevel = await isDesignatedApproverForStage(userId, approvalLevel, mrf);
    if (!isUniversalApprover && !isManagerForThisLevel) {
      return NextResponse.json({ error: "You are not authorized to approve this MRF at its current stage" }, { status: 403 });
    }
  }

  const resolvedApproverName = (isManagerForThisLevel || isUniversalApprover) ? userName : (approverName || "External Approver");
  const currentLevel = LEVEL_LABEL[mrf.status];
  const now = new Date();
  const recordId = newId();

  // Shared by "approve" and "skip" — both advance the MRF to whatever
  // STATUS_FLOW says is next (assigning mrfNumber/approvedAt if that lands
  // on APPROVED) and differ only in the approval record's status/actor and
  // who gets notified about it.
  async function advanceStage(recordStatus: "APPROVED" | "SKIPPED", actorId: string | null, actorName: string, recordNotes: string | null) {
    const nextStatus = STATUS_FLOW[mrf.status];
    const isFinal = nextStatus === "APPROVED";
    const approvedAt = isFinal ? now : null;
    // Reference number is assigned exactly once, right here, the moment the
    // MRF clears its last stage — never at creation.
    const assignedMrfNumber = isFinal ? await generateMRFNumber() : null;

    await db.transaction(async (trx) => {
      await trx("RECRUIT_T_MRFApprovalRecord").insert({
        id: recordId,
        mrfId: id,
        level: currentLevel,
        approverRole: role,
        approverName: actorName,
        approverDesignation: approverDesignation || null,
        approverId: actorId,
        status: recordStatus,
        notes: recordNotes,
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
          // their reminders too. The notification below resets the 3-day
          // reminder clock for the new stage's approver(s).
          ...(!isFinal
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
        const verb = recordStatus === "SKIPPED" ? `had its ${currentLevel.replace(/_/g, " ")} level skipped by ${actorName} and` : `has been approved at ${currentLevel.replace(/_/g, " ")} level and`;

        await Promise.all(recipients.map(async (approver: any) => {
          await createNotification(
            approver.id,
            `MRF ${mrf.referenceNumber} awaiting your approval`,
            `"${mrf.title}" ${verb} requires your review.`,
            `/dashboard/approvals`
          );
          await sendApprovalEmail(approver.email, approver.name, mrf.referenceNumber, mrf.title);
        }));
      } else {
        const suffix = recordStatus === "SKIPPED" ? ` (final level skipped by ${actorName})` : "";
        await createNotification(
          mrf.createdById,
          `MRF ${mrf.referenceNumber} approved`,
          `Your MRF "${mrf.title}" (${mrf.referenceNumber}) has been fully approved${suffix} and assigned MRF number ${assignedMrfNumber}.`,
          `/dashboard/mrfs/${id}`
        );
      }
    } catch { /* notification/email failure is non-fatal */ }
  }

  if (action === "approve") {
    await advanceStage("APPROVED", isManagerForThisLevel ? userId : null, resolvedApproverName, notes || null);

  } else if (action === "skip") {
    if (!notes?.trim()) {
      return NextResponse.json({ error: "A reason is required to skip this approval level" }, { status: 400 });
    }
    await advanceStage("SKIPPED", userId, userName, notes.trim());

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
