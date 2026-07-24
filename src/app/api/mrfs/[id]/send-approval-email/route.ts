import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";
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
    .leftJoin("RECRUIT_T_Country as c", "c.id", "m.countryId")
    .leftJoin("RECRUIT_T_Department as dep", "dep.id", "m.departmentId")
    .leftJoin("RECRUIT_T_Branch as b", "b.id", "m.branchId")
    .leftJoin("RECRUIT_T_Division as div", "div.id", "m.divisionId")
    .where("m.id", id)
    .select(
      "m.*",
      "c.name as countryName", "dep.name as deptName", "b.name as branchName", "div.name as divisionName"
    )
    .first();
  if (!mrf) return NextResponse.json({ error: "MRF not found" }, { status: 404 });

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

  // Record in Email table
  try {
    await db("RECRUIT_T_Email").insert({
      id: newId(),
      fromId: userId,
      toEmail,
      subject: `Action Required: ${mrf.mrfNumber} — ${mrf.title}`,
      body: emailBody,
      isRead: 0,
      mrfId: id,
      sentAt: new Date(),
    });
  } catch (err) {
    console.error("Email record insert failed:", err);
  }

  return NextResponse.json({ success: true });
}
