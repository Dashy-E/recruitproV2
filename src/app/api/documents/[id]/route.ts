import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { join } from "path";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { approvalStatus, approvalNotes } = await req.json();

  if (!["APPROVED", "REJECTED"].includes(approvalStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const doc = await prisma.document.update({
    where: { id },
    data: { approvalStatus, approvalNotes: approvalNotes || null },
  });

  return NextResponse.json(doc);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Remove physical file (best-effort — don't fail the request if already gone)
  try {
    const filename = doc.fileUrl.split("/uploads/")[1];
    if (filename) await unlink(join(process.cwd(), "public", "uploads", filename));
  } catch {
    // file may already be missing
  }

  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
