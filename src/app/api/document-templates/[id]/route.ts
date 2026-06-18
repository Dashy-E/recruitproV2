import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { join } from "path";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM DocumentTemplate WHERE id = ?`, id
  );
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const template = rows[0];

  // Delete physical file (best-effort)
  try {
    const relative = template.fileUrl.replace(/^\//, "");
    await unlink(join(process.cwd(), "public", relative));
  } catch { /* file may already be gone */ }

  await prisma.$queryRawUnsafe(`DELETE FROM DocumentTemplate WHERE id = ?`, id);
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { name, description } = await req.json();
  const now = new Date().toISOString();

  await prisma.$queryRawUnsafe(
    `UPDATE DocumentTemplate SET name = ?, description = ?, updatedAt = ? WHERE id = ?`,
    name, description || null, now, id
  );
  const [template] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM DocumentTemplate WHERE id = ?`, id
  );
  return NextResponse.json(template);
}
