import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role || "";
  const userId = (session.user as { id?: string })?.id!;
  if (!["ADMIN", "HR", "BRANCH_MANAGER", "DIVISIONAL_MANAGER", "FUNCTIONAL_HEAD", "COUNTRY_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { toEmail, message } = await req.json();
  if (!toEmail) return NextResponse.json({ error: "toEmail is required" }, { status: 400 });

  const mrfRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT m.*, c.name as countryName, dep.name as deptName, b.name as branchName, div.name as divisionName
     FROM MRF m
     LEFT JOIN Country c ON c.id = m.countryId
     LEFT JOIN Department dep ON dep.id = m.departmentId
     LEFT JOIN Branch b ON b.id = m.branchId
     LEFT JOIN Division div ON div.id = m.divisionId
     WHERE m.id = ?`,
    id
  );
  if (!mrfRows.length) return NextResponse.json({ error: "MRF not found" }, { status: 404 });
  const mrf = mrfRows[0];

  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const mrfLink = `${appUrl}/dashboard/mrfs/${id}`;

  const statusLabels: Record<string, string> = {
    PENDING_DIVISIONAL: "Pending Divisional Approval",
    PENDING_FUNCTIONAL: "Pending Functional Head Approval",
    PENDING_COUNTRY: "Pending Country Manager Approval",
    APPROVED: "Fully Approved",
    REJECTED: "Rejected",
  };
  const statusLabel = statusLabels[mrf.status] || mrf.status;

  const emailBody = [
    message ? `${message}\n` : "",
    `MRF Details:`,
    `  Reference : ${mrf.mrfNumber}`,
    `  Title     : ${mrf.title}`,
    `  Country   : ${mrf.countryName || "—"}`,
    mrf.divisionName ? `  Division  : ${mrf.divisionName}` : "",
    mrf.branchName ? `  Branch    : ${mrf.branchName}` : "",
    `  Department: ${mrf.deptName || "—"}`,
    `  Vacancies : ${mrf.vacancyCount}`,
    mrf.ctcRange ? `  CTC Range : ${mrf.ctcRange}` : "",
    `  Status    : ${statusLabel}`,
    ``,
    `Review the MRF directly by clicking the link below:`,
    mrfLink,
    ``,
    `If you are unable to click the link, copy and paste it into your browser.`,
    ``,
    `Thank you,`,
    `RecruitPro ERP`,
  ].filter((l) => l !== "").join("\n");

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
        subject: `Action Required: ${mrf.mrfNumber} — ${mrf.title}`,
        text: emailBody,
      });
    } catch (err) {
      console.error("SMTP send failed:", err);
    }
  }

  // Record in Email table (mrfId column added in earlier migration)
  try {
    const emailId = `email_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    await prisma.$queryRawUnsafe(
      `INSERT INTO Email (id, fromId, toEmail, subject, body, isRead, mrfId, sentAt) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      emailId,
      userId,
      toEmail,
      `Action Required: ${mrf.mrfNumber} — ${mrf.title}`,
      emailBody,
      id,
      now
    );
  } catch (err) {
    console.error("Email record insert failed:", err);
  }

  return NextResponse.json({ success: true });
}
