import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateMRFNumber } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const countryId = searchParams.get("countryId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (countryId) where.countryId = countryId;

  const mrfs = await prisma.mRF.findMany({
    where,
    include: {
      country: true,
      division: true,
      branch: true,
      department: true,
      designation: true,
      createdBy: { select: { name: true, email: true } },
      approvalRecords: { orderBy: { recordedAt: "desc" } },
      _count: { select: { candidates: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(mrfs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;
  if (!["ADMIN", "HR", "BRANCH_MANAGER"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, countryId, divisionId, branchId, departmentId, designationId, vacancyCount, justification } = body;

  if (!title || !countryId || !departmentId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const mrf = await prisma.mRF.create({
    data: {
      mrfNumber: generateMRFNumber(),
      title,
      countryId,
      divisionId: divisionId || null,
      branchId,
      departmentId,
      designationId: designationId || null,
      vacancyCount: vacancyCount || 1,
      justification,
      status: "PENDING_DIVISIONAL",
      createdById: userId!,
    },
    include: {
      country: true,
      branch: true,
      department: true,
      createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json(mrf, { status: 201 });
}
