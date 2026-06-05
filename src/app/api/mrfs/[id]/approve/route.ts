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

// Which MRF status each manager role can act on
const ROLE_TO_PENDING: Record<string, string> = {
  DIVISIONAL_MANAGER: "PENDING_DIVISIONAL",
  FUNCTIONAL_HEAD: "PENDING_FUNCTIONAL",
  COUNTRY_MANAGER: "PENDING_COUNTRY",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role || "";
  const userId = (session.user as { id?: string })?.id!;
  const userName = session.user?.name || "Unknown";

  const { id } = await params;
  const body = await req.json();
  const { action, approverName, notes } = body;

  const mrf = await prisma.mRF.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  });
  if (!mrf) return NextResponse.json({ error: "MRF not found" }, { status: 404 });

  if (mrf.status === "APPROVED" || mrf.status === "REJECTED" || mrf.status === "DRAFT") {
    return NextResponse.json({ error: "MRF cannot be updated in current status" }, { status: 400 });
  }

  const isAdminOrHR = ["ADMIN", "HR"].includes(role);
  const isManagerForThisLevel = ROLE_TO_PENDING[role] === mrf.status;

  if (!isAdminOrHR && !isManagerForThisLevel) {
    return NextResponse.json({ error: "You are not authorized to approve this MRF at its current stage" }, { status: 403 });
  }

  // For managers acting on their own level, use their session name automatically
  const resolvedApproverName = isManagerForThisLevel
    ? userName
    : (approverName || "External Approver");

  const currentLevel = LEVEL_MAP[mrf.status];

  if (action === "approve") {
    const nextStatus = STATUS_FLOW[mrf.status];
    await prisma.$transaction([
      prisma.mRFApprovalRecord.create({
        data: {
          mrfId: id,
          level: currentLevel,
          approverName: resolvedApproverName,
          approverId: isManagerForThisLevel ? userId : null,
          status: "APPROVED",
          notes: notes || null,
          recordedById: userId,
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
          approverName: resolvedApproverName,
          approverId: isManagerForThisLevel ? userId : null,
          status: "REJECTED",
          notes: notes || null,
          recordedById: userId,
        },
      }),
      prisma.mRF.update({
        where: { id },
        data: { status: "REJECTED", rejectedAt: new Date(), rejectionReason: notes },
      }),
    ]);
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
