import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { uploadToS3, deleteFromS3, getSignedFileUrl } from "@/lib/s3";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
];
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_CANDIDATES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const candidate = await db("RECRUIT_T_Candidate").where({ id }).first();
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: "Only PDF, DOC, DOCX, PNG, or JPG files are accepted" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Per-candidate folder is "<First Name>_<candidate id>" — the id is the
  // "unique number" (already guaranteed unique and stable across re-uploads),
  // the name just makes the folder recognizable at a glance in the bucket.
  // Always under Recruitment/Candidate directly — not nested under the MRF's
  // own folder — regardless of whether the candidate is linked to an MRF.
  const candidateFolder = `${candidate.firstName.replace(/[^a-zA-Z0-9]/g, "") || "Candidate"}_${id}`;
  const key = `Recruitment/Candidate/${candidateFolder}/${Date.now()}-${safeFileName}`;

  const previousKey = candidate.resumeUrl as string | null;
  await uploadToS3(key, buffer, file.type);

  await db("RECRUIT_T_Candidate").where({ id }).update({ resumeUrl: key, updatedAt: new Date() });

  // Best-effort cleanup of the old object — never let this block the
  // response, the new resume is already saved either way.
  if (previousKey && !previousKey.startsWith("/")) {
    deleteFromS3(previousKey).catch(() => {});
  }

  return NextResponse.json({ resumeUrl: await getSignedFileUrl(key) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_CANDIDATES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const candidate = await db("RECRUIT_T_Candidate").where({ id }).first();
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  const existingKey = candidate.resumeUrl as string | null;
  if (!existingKey) return NextResponse.json({ error: "No resume to delete" }, { status: 400 });

  await db("RECRUIT_T_Candidate").where({ id }).update({ resumeUrl: null, updatedAt: new Date() });

  if (!existingKey.startsWith("/")) {
    deleteFromS3(existingKey).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
