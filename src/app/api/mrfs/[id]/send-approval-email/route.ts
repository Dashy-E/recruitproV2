import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";
import { getAllOrgUnits, getAncestorPath } from "@/lib/org-access";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id!;
  if (!hasPermission(session, "SEND_MRF_APPROVAL_EMAIL")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { toEmail, message } = await req.json();
  if (!toEmail) return NextResponse.json({ error: "toEmail is required" }, { status: 400 });

  const mrf = await db("RECRUIT_T_MRF as m")
    .leftJoin("RECRUIT_T_Department as dep", "dep.id", "m.departmentId")
    .where("m.id", id)
    .select("m.*", "dep.name as deptName")
    .first();
  if (!mrf) return NextResponse.json({ error: "MRF not found" }, { status: 404 });

  const sender = await db("RECRUIT_T_User as u")
    .join("RECRUIT_T_Role as r", "r.key", "u.role")
    .where("u.id", userId)
    .select("u.name", "u.email", "r.label as roleLabel")
    .first();

  const orgUnitPath = getAncestorPath(mrf.orgUnitId, await getAllOrgUnits());
  const orgUnitLabel = orgUnitPath.map((p) => p.name).join(" / ");

  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const mrfLink = `${appUrl}/dashboard/mrfs/${id}`;

  const statusLabels: Record<string, string> = {
    PENDING_DIVISIONAL: "Pending Divisional/Country Manager Approval",
    PENDING_COUNTRY_SUPERVISOR: "Pending Country Supervisor Approval",
    PENDING_FUNCTIONAL: "Pending Functional Head Approval",
    APPROVED: "Fully Approved",
    REJECTED: "Rejected",
  };
  const statusLabel = statusLabels[mrf.status] || mrf.status;

  const subjectLine = `Action Required: ${mrf.mrfNumber || mrf.referenceNumber} — ${mrf.title}`;

  const emailBody = [
    message ? `${message}\n` : null,
    `MRF Details:`,
    `  Reference : ${mrf.referenceNumber}`,
    mrf.mrfNumber ? `  MRF No.   : ${mrf.mrfNumber}` : null,
    `  Title     : ${mrf.title}`,
    `  Location  : ${orgUnitLabel || "—"}`,
    `  Department: ${mrf.deptName || "—"}`,
    `  Vacancies : ${mrf.vacancyCount}`,
    mrf.ctcRange ? `  CTC Range : ${mrf.ctcRange}` : null,
    `  Status    : ${statusLabel}`,
    ``,
    `Review the MRF directly by clicking the link below:`,
    mrfLink,
    ``,
    `If you are unable to click the link, copy and paste it into your browser.`,
    ``,
    `Thanks & Regards`,
    sender?.name || null,
    sender?.roleLabel || null,
    sender?.email || null,
  ].filter((l) => l !== null).join("\n");

  // Try SMTP
  if (process.env.SMTP_HOST) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@recruitpro.com",
        to: toEmail,
        subject: subjectLine,
        text: emailBody,
      });
    } catch (err) {
      console.error("SMTP send failed:", err);
    }
  }

  // Record in Email table
  try {
    await db("RECRUIT_T_Email").insert({
      id: newId(),
      fromId: userId,
      toEmail,
      subject: subjectLine,
      body: emailBody,
      isRead: 0,
      mrfId: id,
      sentAt: new Date(),
    });
  } catch (err) {
    console.error("Email record insert failed:", err);
  }

  // A mail just went out to this stage's approver — restart the 3-day
  // reminder clock (src/lib/mrf-reminders.ts) from here rather than leaving
  // it counting from whenever the last automatic notification fired.
  await db("RECRUIT_T_MRF").where({ id }).update({ lastReminderSentAt: new Date() }).catch(() => {});

  return NextResponse.json({ success: true });
}
