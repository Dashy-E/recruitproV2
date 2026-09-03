import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

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

  const uploadDir = join(process.cwd(), "public", "uploads", "signatures");
  await mkdir(uploadDir, { recursive: true });

  const safeFileName = `${id}-${Date.now()}${ext}`;
  await writeFile(join(uploadDir, safeFileName), buffer);
  const signatureUrl = `/uploads/signatures/${safeFileName}`;

  await db("RECRUIT_T_User").where({ id }).update({ signatureUrl, updatedAt: new Date() });

  return NextResponse.json({ signatureUrl });
}
