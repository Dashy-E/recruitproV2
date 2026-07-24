import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { toBool } from "@/lib/db-bool";
import { hasPermission } from "@/lib/permissions";

async function generateMRFNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MRF-${year}-`;
  const lastMrf = await db("RECRUIT_T_MRF")
    .whereRaw('"mrfNumber" LIKE ?', [`${prefix}%`])
    .orderBy("mrfNumber", "desc")
    .first();
  let seq = 1;
  if (lastMrf) {
    const n = parseInt(lastMrf.mrfNumber.slice(prefix.length), 10);
    if (!isNaN(n)) seq = n + 1;
  }
  return `${prefix}${seq.toString().padStart(4, "0")}`;
}

async function attachRelations(mrfs: any[]) {
  if (!mrfs.length) return [];
  const ids = mrfs.map((m) => m.id);
  const countryIds = [...new Set(mrfs.map((m) => m.countryId).filter(Boolean))];
  const divisionIds = [...new Set(mrfs.map((m) => m.divisionId).filter(Boolean))];
  const branchIds = [...new Set(mrfs.map((m) => m.branchId).filter(Boolean))];
  const departmentIds = [...new Set(mrfs.map((m) => m.departmentId).filter(Boolean))];
  const designationIds = [...new Set(mrfs.map((m) => m.designationId).filter(Boolean))];
  const createdByIds = [...new Set(mrfs.map((m) => m.createdById).filter(Boolean))];

  const [countries, divisions, branches, departments, designations, creators, approvalRecords, candidateCounts] =
    await Promise.all([
      db("RECRUIT_T_Country").whereIn("id", countryIds),
      db("RECRUIT_T_Division").whereIn("id", divisionIds),
      db("RECRUIT_T_Branch").whereIn("id", branchIds),
      db("RECRUIT_T_Department").whereIn("id", departmentIds),
      db("RECRUIT_T_Designation").whereIn("id", designationIds),
      db("RECRUIT_T_User").whereIn("id", createdByIds).select("id", "name", "email"),
      db("RECRUIT_T_MRFApprovalRecord").whereIn("mrfId", ids).orderBy("recordedAt", "desc"),
      db("RECRUIT_T_Candidate").whereIn("mrfId", ids).groupBy("mrfId").select("mrfId").count({ count: "*" }),
    ]);

  return mrfs.map((m) => ({
    ...m,
    country: countries.find((c: any) => c.id === m.countryId) || null,
    division: divisions.find((d: any) => d.id === m.divisionId) || null,
    branch: branches.find((b: any) => b.id === m.branchId) || null,
    department: departments.find((d: any) => d.id === m.departmentId) || null,
    designation: designations.find((d: any) => d.id === m.designationId) || null,
    createdBy: (() => {
      const u = creators.find((c: any) => c.id === m.createdById);
      return u ? { name: u.name, email: u.email } : null;
    })(),
    approvalRecords: approvalRecords.filter((r: any) => r.mrfId === m.id),
    _count: {
      candidates: Number(candidateCounts.find((c: any) => c.mrfId === m.id)?.count || 0),
    },
  }));
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const countryId = searchParams.get("countryId");

  const mrfs = await db("RECRUIT_T_MRF")
    .modify((qb) => {
      if (status) qb.where({ status });
      if (countryId) qb.where({ countryId });
    })
    .orderBy("createdAt", "desc");

  return NextResponse.json(await attachRelations(mrfs));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id;
  if (!hasPermission(session, "CREATE_MRF")) {
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

  const now = new Date();
  const id = newId();

  const [mrf] = await db("RECRUIT_T_MRF")
    .insert({
      id,
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
      isNewRole: toBool(body.isNewRole),
      isBusinessExpansion: toBool(body.isBusinessExpansion),
      newRoleJustification: body.newRoleJustification || null,
      isBudgeted: body.isBudgeted === undefined || body.isBudgeted === null ? null : toBool(body.isBudgeted),
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
      contributionJustified: toBool(body.contributionJustified),
      fillerName: body.fillerName || null,
      fillerDesignation: body.fillerDesignation || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning("*");

  const [country, branch, department, creator] = await Promise.all([
    db("RECRUIT_T_Country").where({ id: countryId }).first(),
    db("RECRUIT_T_Branch").where({ id: branchId }).first(),
    db("RECRUIT_T_Department").where({ id: departmentId }).first(),
    db("RECRUIT_T_User").where({ id: userId }).select("name").first(),
  ]);

  const mrfWithRelations = {
    ...mrf,
    country: country || null,
    branch: branch || null,
    department: department || null,
    createdBy: creator ? { name: creator.name } : null,
  };

  // Notify Divisional Managers that a new MRF needs approval
  const divisionalManagers = await db("RECRUIT_T_User")
    .where({ role: "DIVISIONAL_MANAGER", isActive: 1 })
    .select("id");
  await Promise.all(
    divisionalManagers.map((mgr: any) =>
      db("RECRUIT_T_Notification").insert({
        id: newId(),
        userId: mgr.id,
        type: "MRF_APPROVAL",
        title: `New MRF ${mrf.mrfNumber} requires your approval`,
        message: `"${mrf.title}" has been submitted and is awaiting divisional approval.`,
        link: `/dashboard/approvals`,
        createdAt: now,
      })
    )
  );

  return NextResponse.json(mrfWithRelations, { status: 201 });
}
