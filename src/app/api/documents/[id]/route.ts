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

  const docs = await prisma.$queryRawUnsafe<any[]>(
    `SELECT d.*, c.userId FROM Document d LEFT JOIN Candidate c ON c.id = d.candidateId WHERE d.id = ?`, id
  );
  if (!docs.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const doc = docs[0];

  if (approvalStatus === "REJECTED") {
    // Delete physical file
    try {
      const filename = doc.fileUrl?.split("/uploads/")[1];
      if (filename) await unlink(join(process.cwd(), "public", "uploads", filename));
    } catch { /* file may already be missing */ }

    // Delete DB record
    await prisma.$queryRawUnsafe(`DELETE FROM Document WHERE id = ?`, id);

    // Notify the document owner
    if (doc.userId) {
      const userRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT role FROM User WHERE id = ?`, doc.userId
      );
      const ownerRole = userRows[0]?.role || "CANDIDATE";
      const notifLink = ownerRole === "EMPLOYEE" ? "/dashboard/employee-portal" : "/dashboard";
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();
      const reason = approvalNotes ? ` Reason: ${approvalNotes}` : "";
      await prisma.$queryRawUnsafe(
        `INSERT INTO Notification (id, userId, title, message, link, isRead, createdAt) VALUES (?, ?, ?, ?, ?, 0, ?)`,
        notifId, doc.userId,
        "Document Rejected — Please Re-upload",
        `Your document "${doc.name}" was rejected and removed.${reason} Please upload a replacement.`,
        notifLink, now
      );
    }

    return NextResponse.json({ success: true, deleted: true });
  }

  // APPROVED — just update status
  await prisma.$queryRawUnsafe(
    `UPDATE Document SET approvalStatus = ?, approvalNotes = ? WHERE id = ?`,
    approvalStatus,
    approvalNotes || null,
    id
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const docs = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM Document WHERE id = ?`, id);
  if (!docs.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const doc = docs[0];

  try {
    const filename = doc.fileUrl?.split("/uploads/")[1];
    if (filename) await unlink(join(process.cwd(), "public", "uploads", filename));
  } catch { /* file may already be missing */ }

  await prisma.$queryRawUnsafe(`DELETE FROM Document WHERE id = ?`, id);
  return NextResponse.json({ success: true });
}
