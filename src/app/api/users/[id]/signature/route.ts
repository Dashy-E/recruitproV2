import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { uploadToS3, deleteFromS3, getSignedFileUrl } from "@/lib/s3";

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg"];
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const isSelf = id === (session.user as { id?: string })?.id;
  // Anyone can upload their own signature (self-service profile); MANAGE_USERS
  // is required to upload on behalf of someone else (Users -> Edit).
  if (!isSelf && !hasPermission(session, "MANAGE_USERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await db("RECRUIT_T_User").where({ id }).first();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: "Only PNG, JPG, or JPEG files are accepted" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const previousKey = target.signatureUrl as string | null;
  const key = `Recruitment/signature/${id}Signature${ext}`;
  await uploadToS3(key, buffer, file.type);

  await db("RECRUIT_T_User").where({ id }).update({ signatureUrl: key, updatedAt: new Date() });

  // Best-effort cleanup of the old object — never let this block the
  // response, the new signature is already saved either way.
  if (previousKey) {
    deleteFromS3(previousKey).catch(() => {});
  }

  return NextResponse.json({ signatureUrl: await getSignedFileUrl(key) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const isSelf = id === (session.user as { id?: string })?.id;
  if (!isSelf && !hasPermission(session, "MANAGE_USERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await db("RECRUIT_T_User").where({ id }).first();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existingKey = target.signatureUrl as string | null;
  if (!existingKey) return NextResponse.json({ error: "No signature to delete" }, { status: 400 });

  await db("RECRUIT_T_User").where({ id }).update({ signatureUrl: null, updatedAt: new Date() });

  // Removes only this one object — S3 has no real folders (just key
  // prefixes), so there is nothing else to clean up. Best-effort: the DB
  // is already the source of truth once signatureUrl is cleared above.
  if (!existingKey.startsWith("/")) {
    deleteFromS3(existingKey).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
