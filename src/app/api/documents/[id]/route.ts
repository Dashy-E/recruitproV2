import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";
import { unlink } from "fs/promises";
import { join } from "path";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_DOCUMENTS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { approvalStatus, approvalNotes } = await req.json();

  if (!["APPROVED", "REJECTED"].includes(approvalStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const doc = await db("RECRUIT_T_Document as d")
    .leftJoin("RECRUIT_T_Candidate as c", "c.id", "d.candidateId")
    .where("d.id", id)
    .select("d.*", "c.userId")
    .first();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (approvalStatus === "REJECTED") {
    // Delete physical file
    try {
      const filename = doc.fileUrl?.split("/uploads/")[1];
      if (filename) await unlink(join(process.cwd(), "public", "uploads", filename));
    } catch { /* file may already be missing */ }

    // Delete DB record
    await db("RECRUIT_T_Document").where({ id }).del();

    // Notify the document owner
    if (doc.userId) {
      const owner = await db("RECRUIT_T_User").where({ id: doc.userId }).select("role").first();
      const ownerRole = owner?.role || "CANDIDATE";
      const notifLink = ownerRole === "EMPLOYEE" ? "/dashboard/employee-portal" : "/dashboard";
      const reason = approvalNotes ? ` Reason: ${approvalNotes}` : "";
      await db("RECRUIT_T_Notification").insert({
        id: newId(),
        userId: doc.userId,
        type: "DOCUMENT",
        title: "Document Rejected — Please Re-upload",
        message: `Your document "${doc.name}" was rejected and removed.${reason} Please upload a replacement.`,
        link: notifLink,
        isRead: 0,
        createdAt: new Date(),
      });
    }

    return NextResponse.json({ success: true, deleted: true });
  }

  // APPROVED — just update status
  await db("RECRUIT_T_Document")
    .where({ id })
    .update({ approvalStatus, approvalNotes: approvalNotes || null });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_DOCUMENTS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const doc = await db("RECRUIT_T_Document").where({ id }).first();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const filename = doc.fileUrl?.split("/uploads/")[1];
    if (filename) await unlink(join(process.cwd(), "public", "uploads", filename));
  } catch { /* file may already be missing */ }

  await db("RECRUIT_T_Document").where({ id }).del();
  return NextResponse.json({ success: true });
}
