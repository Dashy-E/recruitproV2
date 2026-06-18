import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
async function generateMRFNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MRF-${year}-`;
  const lastMrf = await prisma.mRF.findFirst({
    where: { mrfNumber: { startsWith: prefix } },
    orderBy: { mrfNumber: "desc" },
  });
  let seq = 1;
  if (lastMrf) {
    const n = parseInt(lastMrf.mrfNumber.slice(prefix.length), 10);
    if (!isNaN(n)) seq = n + 1;
  }
  return `${prefix}${seq.toString().padStart(4, "0")}`;
}

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
  if (!["ADMIN", "HR", "BRANCH_MANAGER", "COUNTRY_MANAGER"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, countryId, divisionId, branchId, departmentId, designationId, vacancyCount, justification } = body;

  if (!title || !countryId || !departmentId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!body.ctcRange?.trim()) {
    return NextResponse.json({ error: "CTC Range is required" }, { status: 400 });
  }
  if (!body.fillerName?.trim() || !body.fillerDesignation?.trim()) {
    return NextResponse.json({ error: "Name and designation of person raising MRF are required" }, { status: 400 });
  }

  const mrf = await prisma.mRF.create({
    data: {
      mrfNumber: await generateMRFNumber(),
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
      // Extended MRF fields
      vacancyType: body.vacancyType || null,
      replacedEmployeeName: body.replacedEmployeeName || null,
      replacedEmployeeCTC: body.replacedEmployeeCTC || null,
      replacementFor: body.replacementFor || null,
      replacementReason: body.replacementReason || null,
      replacementNecessityReason: body.replacementNecessityReason || null,
      isNewRole: body.isNewRole || false,
      isBusinessExpansion: body.isBusinessExpansion || false,
      newRoleJustification: body.newRoleJustification || null,
      isBudgeted: body.isBudgeted ?? null,
      proposedGrade: body.proposedGrade || null,
      ctcRange: body.ctcRange || null,
      location: body.location || null,
      reportingTo: body.reportingTo || null,
      jobProfile: body.jobProfile || null,
      minAge: body.minAge || null,
      maxAge: body.maxAge || null,
      minQualification: body.minQualification || null,
      preferredQualification: body.preferredQualification || null,
      workExperience: body.workExperience || null,
      industryBackground: body.industryBackground || null,
      otherSpecs: body.otherSpecs || null,
      contributionJustified: body.contributionJustified || false,
      fillerName: body.fillerName || null,
      fillerDesignation: body.fillerDesignation || null,
    },
    include: {
      country: true,
      branch: true,
      department: true,
      createdBy: { select: { name: true } },
    },
  });

  // Notify Divisional Managers that a new MRF needs approval
  const divisionalManagers = await prisma.user.findMany({
    where: { role: "DIVISIONAL_MANAGER", isActive: true },
    select: { id: true },
  });
  await Promise.all(
    divisionalManagers.map((mgr) =>
      prisma.notification.create({
        data: {
          userId: mgr.id,
          type: "MRF_APPROVAL",
          title: `New MRF ${mrf.mrfNumber} requires your approval`,
          message: `"${mrf.title}" has been submitted and is awaiting divisional approval.`,
          link: `/dashboard/approvals`,
        },
      })
    )
  );

  return NextResponse.json(mrf, { status: 201 });
}
