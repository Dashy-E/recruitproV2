import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role || "";
  if (!["ADMIN", "HR"].includes(role)) {
    return NextResponse.json({ error: "Only Admin or HR can restart approval" }, { status: 403 });
  }

  const { id } = await params;

  const mrfRows = await prisma.$queryRawUnsafe<any[]>(`SELECT id, status FROM MRF WHERE id = ?`, id);
  if (!mrfRows.length) return NextResponse.json({ error: "MRF not found" }, { status: 404 });
  const mrf = mrfRows[0];

  if (mrf.status !== "REJECTED") {
    return NextResponse.json({ error: "Only rejected MRFs can be restarted" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Clear all approval records for this MRF so the chain starts fresh
  await prisma.$queryRawUnsafe(`DELETE FROM MRFApprovalRecord WHERE mrfId = ?`, id);

  // Reset MRF to PENDING_DIVISIONAL, clear rejection fields
  await prisma.$queryRawUnsafe(
    `UPDATE MRF SET status = 'PENDING_DIVISIONAL', rejectedAt = NULL, rejectionReason = NULL, approvedAt = NULL, updatedAt = ? WHERE id = ?`,
    now, id
  );

  return NextResponse.json({ success: true });
}
