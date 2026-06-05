import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STATUS_FLOW: Record<string, string> = {
  PENDING_DIVISIONAL: "PENDING_FUNCTIONAL",
  PENDING_FUNCTIONAL: "PENDING_COUNTRY",
  PENDING_COUNTRY: "APPROVED",
};

const LEVEL_MAP: Record<string, string> = {
  PENDING_DIVISIONAL: "DIVISIONAL_MANAGER",
  PENDING_FUNCTIONAL: "FUNCTIONAL_HEAD",
  PENDING_COUNTRY: "COUNTRY_MANAGER",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;

  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Only HR can record approvals" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, approverName, notes } = body;

  const mrf = await prisma.mRF.findUnique({ where: { id } });
  if (!mrf) return NextResponse.json({ error: "MRF not found" }, { status: 404 });

  if (mrf.status === "APPROVED" || mrf.status === "REJECTED" || mrf.status === "DRAFT") {
    return NextResponse.json({ error: "MRF cannot be updated in current status" }, { status: 400 });
  }

  const currentLevel = LEVEL_MAP[mrf.status];

  if (action === "approve") {
    const nextStatus = STATUS_FLOW[mrf.status];
    await prisma.$transaction([
      prisma.mRFApprovalRecord.create({
        data: {
          mrfId: id,
          level: currentLevel,
          approverName: approverName || "External Approver",
          status: "APPROVED",
          notes,
          recordedById: userId!,
        },
      }),
      prisma.mRF.update({
        where: { id },
        data: {
          status: nextStatus,
          approvedAt: nextStatus === "APPROVED" ? new Date() : undefined,
        },
      }),
    ]);
  } else if (action === "reject") {
    await prisma.$transaction([
      prisma.mRFApprovalRecord.create({
        data: {
          mrfId: id,
          level: currentLevel,
          approverName: approverName || "External Approver",
          status: "REJECTED",
          notes,
          recordedById: userId!,
        },
      }),
      prisma.mRF.update({
        where: { id },
        data: { status: "REJECTED", rejectedAt: new Date(), rejectionReason: notes },
      }),
    ]);
  }

  return NextResponse.json({ success: true });
}
