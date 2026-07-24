import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const templates = await db("RECRUIT_T_DocumentTemplate as dt")
    .join("RECRUIT_T_User as u", "u.id", "dt.uploadedById")
    .where("dt.isActive", 1)
    .orderBy("dt.createdAt", "desc")
    .select("dt.*", "u.name as uploaderName");
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_DOCUMENTS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = (session.user as { id?: string })?.id!;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const templateType = (formData.get("templateType") as string)?.trim();

  if (!file || !name || !templateType) {
    return NextResponse.json({ error: "File, name and template type are required" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const uploadDir = join(process.cwd(), "public", "uploads", "templates");
  await mkdir(uploadDir, { recursive: true });
  const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await writeFile(join(uploadDir, safeFileName), buffer);
  const fileUrl = `/uploads/templates/${safeFileName}`;

  const now = new Date();

  const [template] = await db("RECRUIT_T_DocumentTemplate")
    .insert({
      id: newId(),
      name,
      description,
      templateType,
      fileUrl,
      fileSize: file.size,
      isActive: 1,
      uploadedById: userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning("*");

  return NextResponse.json(template, { status: 201 });
}
