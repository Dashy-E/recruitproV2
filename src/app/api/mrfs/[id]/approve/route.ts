import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

const STATUS_FLOW: Record<string, string> = {
  PENDING_DIVISIONAL: "PENDING_FUNCTIONAL",
  PENDING_FUNCTIONAL: "PENDING_COUNTRY",
  PENDING_COUNTRY: "APPROVED",
};

const LEVEL_MAP: Record<string, string> = {
  PENDING_DIVISIONAL: "DIVISIONAL_MANAGER",
  PENDING_FUNCTIONAL: "FUNCTIONAL_HEAD",
  PENDING_COUNTRY: "COUNTRY_MANAGER",
};

const ROLE_TO_PENDING: Record<string, string> = {
  DIVISIONAL_MANAGER: "PENDING_DIVISIONAL",
  FUNCTIONAL_HEAD: "PENDING_FUNCTIONAL",
  COUNTRY_MANAGER: "PENDING_COUNTRY",
};

// Who to notify when the MRF moves to each new status
const NOTIFY_ROLE_FOR_STATUS: Record<string, string> = {
  PENDING_FUNCTIONAL: "FUNCTIONAL_HEAD",
  PENDING_COUNTRY: "COUNTRY_MANAGER",
};

async function sendApprovalEmail(toEmail: string, toName: string, mrfNumber: string, mrfTitle: string) {
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
      subject: `Action Required: MRF ${mrfNumber} awaiting your approval`,
      text: `Dear ${toName},\n\nMRF "${mrfTitle}" (${mrfNumber}) has been forwarded for your approval.\n\nPlease log in to review:\n${process.env.NEXTAUTH_URL}/dashboard/approvals\n\nThank you,\nRecruitPro ERP`,
    });
  } catch { /* SMTP failure is non-fatal */ }
}

async function createNotification(userId: string, title: string, message: string, link: string) {
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  await prisma.$queryRawUnsafe(
    `INSERT INTO Notification (id, userId, title, message, link, isRead, createdAt) VALUES (?, ?, ?, ?, ?, 0, ?)`,
    notifId, userId, title, message, link, now
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role || "";
  const userId = (session.user as { id?: string })?.id!;
  const userName = session.user?.name || "Unknown";

  const { id } = await params;
  const body = await req.json();
  const { action, approverName, notes } = body;

  const mrfRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT m.*, u.name as createdByName FROM MRF m JOIN User u ON u.id = m.createdById WHERE m.id = ?`, id
  );
  if (!mrfRows.length) return NextResponse.json({ error: "MRF not found" }, { status: 404 });
  const mrf = mrfRows[0];

  if (["APPROVED", "REJECTED", "DRAFT"].includes(mrf.status)) {
    return NextResponse.json({ error: "MRF cannot be updated in current status" }, { status: 400 });
  }

  const isAdminOrHR = ["ADMIN", "HR"].includes(role);
  // COUNTRY_MANAGER is universal — can act at any pending level
  const isUniversalManager = role === "COUNTRY_MANAGER";
  const isManagerForThisLevel = ROLE_TO_PENDING[role] === mrf.status;

  if (!isAdminOrHR && !isUniversalManager && !isManagerForThisLevel) {
    return NextResponse.json({ error: "You are not authorized to approve this MRF at its current stage" }, { status: 403 });
  }

  const resolvedApproverName = (isManagerForThisLevel || isUniversalManager) ? userName : (approverName || "External Approver");
  const currentLevel = LEVEL_MAP[mrf.status];
  const now = new Date().toISOString();
  const recordId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  if (action === "approve") {
    const nextStatus = STATUS_FLOW[mrf.status];

    // Create approval record (raw SQL — approverRole field added in migration)
    await prisma.$queryRawUnsafe(
      `INSERT INTO MRFApprovalRecord (id, mrfId, level, approverRole, approverName, approverId, status, notes, recordedById, recordedAt)
       VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?)`,
      recordId, id, currentLevel, role, resolvedApproverName,
      isManagerForThisLevel ? userId : null,
      notes || null, userId, now
    );

    // Update MRF status
    const approvedAt = nextStatus === "APPROVED" ? now : null;
    await prisma.$queryRawUnsafe(
      `UPDATE MRF SET status = ?, updatedAt = ?${approvedAt ? ", approvedAt = ?" : ""} WHERE id = ?`,
      ...(approvedAt ? [nextStatus, now, approvedAt, id] : [nextStatus, now, id])
    );

    if (nextStatus !== "APPROVED") {
      const notifyRole = NOTIFY_ROLE_FOR_STATUS[nextStatus];

      // Find next-level approvers AND all COUNTRY_MANAGERs (universal managers)
      // De-duplicate so COUNTRY_MANAGERs don't get two notifs when they're also the next approver
      const nextApprovers = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, email, name FROM User WHERE isActive = 1 AND role = ?`, notifyRole
      );
      const universalManagers = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, email, name FROM User WHERE isActive = 1 AND role = 'COUNTRY_MANAGER'`
      );

      // Merge, deduplicating by id
      const seen = new Set<string>();
      const allRecipients: any[] = [];
      for (const u of [...nextApprovers, ...universalManagers]) {
        if (!seen.has(u.id)) { seen.add(u.id); allRecipients.push(u); }
      }

      await Promise.all(allRecipients.map(async (approver) => {
        await createNotification(
          approver.id,
          `MRF ${mrf.mrfNumber} awaiting your approval`,
          `"${mrf.title}" has been approved at ${currentLevel.replace(/_/g, " ")} level and requires your review.`,
          `/dashboard/approvals`
        );
        await sendApprovalEmail(approver.email, approver.name, mrf.mrfNumber, mrf.title);
      }));
    } else {
      // MRF fully approved — notify the MRF creator
      await createNotification(
        mrf.createdById,
        `MRF ${mrf.mrfNumber} approved`,
        `Your MRF "${mrf.title}" has been fully approved.`,
        `/dashboard/mrfs/${id}`
      );
    }

  } else if (action === "reject") {
    await prisma.$queryRawUnsafe(
      `INSERT INTO MRFApprovalRecord (id, mrfId, level, approverRole, approverName, approverId, status, notes, recordedById, recordedAt)
       VALUES (?, ?, ?, ?, ?, ?, 'REJECTED', ?, ?, ?)`,
      recordId, id, currentLevel, role, resolvedApproverName,
      isManagerForThisLevel ? userId : null,
      notes || null, userId, now
    );

    await prisma.$queryRawUnsafe(
      `UPDATE MRF SET status = 'REJECTED', rejectedAt = ?, rejectionReason = ?, updatedAt = ? WHERE id = ?`,
      now, notes || null, now, id
    );

    // Notify MRF creator
    await createNotification(
      mrf.createdById,
      `MRF ${mrf.mrfNumber} was rejected`,
      `"${mrf.title}" was rejected by ${resolvedApproverName}${notes ? `: ${notes}` : "."}`,
      `/dashboard/mrfs/${id}`
    );

  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
