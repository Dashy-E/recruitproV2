import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id!;

  const emails = await prisma.email.findMany({
    where: { fromId: userId },
    include: { candidate: { select: { firstName: true, lastName: true } } },
    orderBy: { sentAt: "desc" },
  });
  return NextResponse.json(emails);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id!;

  const { toEmail, subject, body, candidateId, mrfId } = await req.json();
  if (!toEmail || !subject || !body) return NextResponse.json({ error: "toEmail, subject, body required" }, { status: 400 });

  // Try to send via SMTP if configured
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: toEmail,
        subject,
        text: body,
      });
    } catch (err) {
      console.error("SMTP send failed:", err);
    }
  }

  const email = await prisma.email.create({
    data: { fromId: userId, toEmail, subject, body, candidateId: candidateId || null, mrfId: mrfId || null },
  });
  return NextResponse.json(email, { status: 201 });
}
