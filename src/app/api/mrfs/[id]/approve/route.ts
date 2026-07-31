import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { STATUS_TO_APPROVAL_LEVEL, ApprovalLevel } from "@/lib/permissions";
import { generateMRFNumber } from "@/lib/mrf-number";
import nodemailer from "nodemailer";

const STATUS_FLOW: Record<string, string> = {
  PENDING_DIVISIONAL: "PENDING_FUNCTIONAL",
  PENDING_FUNCTIONAL: "PENDING_COUNTRY",
  PENDING_COUNTRY: "APPROVED",
};

// Display label stored on the approval record / used in notification text —
// unrelated to the approvalLevel permission enum used for authorization below.
const LEVEL_LABEL: Record<string, string> = {
  PENDING_DIVISIONAL: "DIVISIONAL_MANAGER",
  PENDING_FUNCTIONAL: "FUNCTIONAL_HEAD",
  PENDING_COUNTRY: "COUNTRY_MANAGER",
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
  // MRF's current pending stage.
  const isUniversalApprover = approvalLevel === "ANY";
  const isManagerForThisLevel = !!approvalLevel && approvalLevel === STATUS_TO_APPROVAL_LEVEL[mrf.status];

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
        });
    });

    // Notifications and emails are non-fatal — DB changes above are already committed
    try {
      if (nextStatus !== "APPROVED") {
        const nextLevel = STATUS_TO_APPROVAL_LEVEL[nextStatus];
        // Notify every active user whose role approves at this level, or is a
        // universal ("ANY") approver.
        const recipients = await db("RECRUIT_T_User as u")
          .join("RECRUIT_T_Role as r", "r.key", "u.role")
          .where("u.isActive", 1)
          .where((qb) => {
            qb.where("r.approvalLevel", nextLevel).orWhere("r.approvalLevel", "ANY");
          })
          .select("u.id", "u.email", "u.name");

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
