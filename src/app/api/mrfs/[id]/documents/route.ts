import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";
import { getUsersWithPermission } from "@/lib/mrf-approval";
import { uploadToS3, getSignedFileUrl } from "@/lib/s3";
import nodemailer from "nodemailer";

const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];

async function notifyFinalApprovers(mrfReferenceNumber: string, mrfTitle: string, mrfId: string) {
  try {
    const recipients = await getUsersWithPermission("FINAL_APPROVE_MRF");
    await Promise.all(recipients.map(async (u) => {
      await db("RECRUIT_T_Notification").insert({
        id: newId(),
        userId: u.id,
        type: "MRF_APPROVAL",
        title: `MRF ${mrfReferenceNumber} ready for final approval`,
        message: `Supporting documents for "${mrfTitle}" have been uploaded and it's awaiting your final decision.`,
        link: `/dashboard/mrfs/${mrfId}`,
        isRead: 0,
        createdAt: new Date(),
      });
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
          to: u.email,
          subject: `MRF ${mrfReferenceNumber} ready for final approval`,
          text: `Dear ${u.name},\n\nSupporting documents for MRF "${mrfTitle}" (${mrfReferenceNumber}) have been uploaded and it's awaiting your final decision.\n\nPlease log in to review:\n${process.env.NEXTAUTH_URL}/dashboard/mrfs/${mrfId}\n\nThank you,\nRecruitPro ERP`,
        });
      } catch { /* SMTP failure is non-fatal */ }
    }));
  } catch { /* notification failure is non-fatal */ }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "UPLOAD_MRF_DOCUMENTS")) {
    return NextResponse.json({ error: "You do not have permission to upload MRF documents" }, { status: 403 });
  }

  const { id } = await params;
  const userId = (session.user as { id?: string })?.id!;

  const mrf = await db("RECRUIT_T_MRF").where({ id }).first();
  if (!mrf) return NextResponse.json({ error: "MRF not found" }, { status: 404 });
  if (mrf.status !== "PENDING_FINAL_APPROVAL") {
    return NextResponse.json({ error: "Documents can only be uploaded while the MRF is awaiting final approval" }, { status: 400 });
  }

  const formData = await req.formData();
  const files = formData.getAll("file") as File[];
  if (!files.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });

  // Validate every file before uploading any of them — an all-or-nothing
  // request is easier to reason about than a partially-successful batch.
  for (const file of files) {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `"${file.name}": only PDF, PNG, JPG, or JPEG files are accepted` }, { status: 400 });
    }
  }

  const now = new Date();
  const created = [];
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `Recruitment/MRF/${mrf.referenceNumber}/${Date.now()}-${safeFileName}`;
    await uploadToS3(key, buffer, file.type);

    const [doc] = await db("RECRUIT_T_Document")
      .insert({
        id: newId(),
        name: file.name,
        fileUrl: key,
        fileType: file.type,
        fileSize: file.size,
        documentType: "MRF_SUPPORTING",
        uploadedById: userId,
        mrfId: id,
        approvalStatus: "APPROVED",
        createdAt: now,
      })
      .returning("*");
    created.push({ ...doc, fileUrl: await getSignedFileUrl(doc.fileUrl) });
  }

  notifyFinalApprovers(mrf.referenceNumber, mrf.title, id).catch(() => {});

  return NextResponse.json(created, { status: 201 });
}
