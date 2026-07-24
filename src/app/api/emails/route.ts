import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_EMAILS")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id!;

  const emails = await db("RECRUIT_T_Email as e")
    .leftJoin("RECRUIT_T_MRF as m", "m.id", "e.mrfId")
    .where("e.fromId", userId)
    .orderBy("e.sentAt", "desc")
    .select("e.*", "m.id as mrf_id", "m.mrfNumber", "m.title as mrf_title");

  // Reshape mrf sub-object for client
  const shaped = emails.map((e: any) => ({
    ...e,
    mrf: e.mrf_id ? { id: e.mrf_id, mrfNumber: e.mrfNumber, title: e.mrf_title } : null,
  }));
  return NextResponse.json(shaped);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_EMAILS")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const [email] = await db("RECRUIT_T_Email")
    .insert({
      id: newId(),
      fromId: userId,
      toEmail,
      subject,
      body,
      candidateId: candidateId || null,
      mrfId: mrfId || null,
      isRead: 0,
      sentAt: new Date(),
    })
    .returning("*");

  return NextResponse.json(email, { status: 201 });
}
