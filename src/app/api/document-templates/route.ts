import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function GET() {
  const templates = await prisma.$queryRawUnsafe<any[]>(
    `SELECT dt.*, u.name as uploaderName FROM DocumentTemplate dt
     JOIN User u ON u.id = dt.uploadedById
     WHERE dt.isActive = 1
     ORDER BY dt.createdAt DESC`
  );
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
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

  const id = `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  await prisma.$queryRawUnsafe(
    `INSERT INTO DocumentTemplate (id, name, description, templateType, fileUrl, fileSize, isActive, uploadedById, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    id, name, description, templateType, fileUrl, file.size, userId, now, now
  );

  const [template] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM DocumentTemplate WHERE id = ?`, id
  );
  return NextResponse.json(template, { status: 201 });
}
