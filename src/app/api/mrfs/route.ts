import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { toBool } from "@/lib/db-bool";
import { hasPermission } from "@/lib/permissions";
import { getAllOrgUnits, getAncestorPath, getAccessibleOrgUnitIds, expandDescendantsSync } from "@/lib/org-access";
import { generateReferenceNumber, generateMRFNumber } from "@/lib/mrf-number";
import { getEligibleApprovers, isDesignatedApproverForStage, computeInitialMrfState, insertAutoApprovalRecords, STAGE_LEVEL_LABEL } from "@/lib/mrf-approval";
import { ApprovalLevel, STATUS_TO_APPROVAL_LEVELS } from "@/lib/permissions";

async function attachRelations(mrfs: any[], requestingUserId: string, requestingApprovalLevel: ApprovalLevel | null, includeApprovalRecords: boolean) {
  if (!mrfs.length) return [];
  const ids = mrfs.map((m) => m.id);
  const departmentIds = [...new Set(mrfs.map((m) => m.departmentId).filter(Boolean))];
  const designationIds = [...new Set(mrfs.map((m) => m.designationId).filter(Boolean))];
  const createdByIds = [...new Set(mrfs.map((m) => m.createdById).filter(Boolean))];

  // approvalRecords carries a CLOB (notes) column — fetching it under
  // concurrent load has triggered an intermittent Oracle thin-driver LOB
  // error (see the non-CLOB select below). Only the Approvals page actually
  // renders approval notes; every other consumer of this list endpoint
  // (MRFs list, Email, Candidates) never reads .approvalRecords at all, so
  // skip the join for them entirely rather than fetching data nobody uses.
  const [orgUnits, departments, designations, creators, approvalRecords, candidateCounts] =
    await Promise.all([
      getAllOrgUnits(),
      db("RECRUIT_T_Department").whereIn("id", departmentIds),
      db("RECRUIT_T_Designation").whereIn("id", designationIds),
      db("RECRUIT_T_User").whereIn("id", createdByIds).select("id", "name", "email"),
      includeApprovalRecords
        ? db("RECRUIT_T_MRFApprovalRecord").whereIn("mrfId", ids).orderBy("recordedAt", "desc")
        : Promise.resolve([]),
      db("RECRUIT_T_Candidate").whereIn("mrfId", ids).groupBy("mrfId").select("mrfId").count({ count: "*" }),
    ]);

  // Only bother with the org/department-scoped DB check (isDesignatedApproverForStage)
  // for MRFs where the user's role-level even matches the stage — cheap
  // in-memory filter first so a big list doesn't fire one query per row.
  const canApproveById = new Map<string, boolean>();
  await Promise.all(
    mrfs
      .filter((m) => !!requestingApprovalLevel && (STATUS_TO_APPROVAL_LEVELS[m.status] || []).includes(requestingApprovalLevel))
      .map(async (m) => {
        canApproveById.set(m.id, await isDesignatedApproverForStage(requestingUserId, requestingApprovalLevel, m));
      })
  );

  return mrfs.map((m) => {
    const path = getAncestorPath(m.orgUnitId, orgUnits);
    return {
      ...m,
      orgUnit: path.length ? { id: m.orgUnitId, name: path.at(-1)!.name, path: path.map((p) => p.name).join(" / ") } : null,
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
      canApprove: canApproveById.get(m.id) ?? false,
    };
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const orgUnitParam = searchParams.get("orgUnit");

  const accessibleIds = await getAccessibleOrgUnitIds((session.user as { orgUnitIds?: string[] })?.orgUnitIds);

  let allowedIds: string[] | null = accessibleIds;
  if (orgUnitParam) {
    const scoped = new Set(expandDescendantsSync([orgUnitParam], await getAllOrgUnits()));
    allowedIds = accessibleIds ? accessibleIds.filter((id) => scoped.has(id)) : [...scoped];
  }

  // Select only what the list view needs — RECRUIT_T_MRF carries several
  // CLOB columns (justification, rejectionReason, etc.) that aren't rendered
  // in list views, and fetching them under concurrent load has been
  // triggering an intermittent Oracle thin-driver LOB error ("lobImpl.getType
  // is not a function"). The detail endpoint (GET /api/mrfs/[id]) still
  // fetches full rows since those fields are shown there.
  const mrfs = await db("RECRUIT_T_MRF")
    .select(
      "id", "referenceNumber", "mrfNumber", "title", "status", "vacancyCount",
      "orgUnitId", "departmentId", "designationId", "createdById", "createdAt"
    )
    .modify((qb: any) => {
      if (status) qb.where({ status });
      if (allowedIds) qb.whereIn("orgUnitId", allowedIds);
    })
    .orderBy("createdAt", "desc");

  const userId = (session.user as { id?: string })?.id!;
  const approvalLevel = ((session.user as { approvalLevel?: string | null })?.approvalLevel ?? null) as ApprovalLevel | null;
  const includeApprovalRecords = searchParams.get("includeApprovalRecords") === "1";

  return NextResponse.json(await attachRelations(mrfs, userId, approvalLevel, includeApprovalRecords));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id;
  const userRole = (session.user as { role?: string })?.role || "";
  const userName = session.user?.name || "Unknown";
  const approvalLevel = (session.user as { approvalLevel?: ApprovalLevel | null })?.approvalLevel ?? null;
  if (!hasPermission(session, "CREATE_MRF")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, orgUnitId, departmentId, designationId, vacancyCount, justification } = body;

  if (!title || !orgUnitId || !departmentId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!body.ctcRange?.trim()) {
    return NextResponse.json({ error: "CTC Range is required" }, { status: 400 });
  }
  if (!body.fillerName?.trim() || !body.fillerDesignation?.trim()) {
    return NextResponse.json({ error: "Name and designation of person raising MRF are required" }, { status: 400 });
  }

  const orgUnit = await db("RECRUIT_T_OrgUnit").where({ id: orgUnitId }).first();
  if (!orgUnit) return NextResponse.json({ error: "Org unit not found" }, { status: 404 });

  // MRFs must target a specific location, not an umbrella node — reject
  // anything that still has sub-locations underneath it.
  const childCount = await db("RECRUIT_T_OrgUnit")
    .where({ parentId: orgUnitId })
    .count<{ count: string }[]>("* as count")
    .then((r) => Number(r[0].count));
  if (childCount > 0) {
    return NextResponse.json({ error: "Please select a specific location — this org unit has sub-locations under it" }, { status: 400 });
  }

  const accessibleIds = await getAccessibleOrgUnitIds((session.user as { orgUnitIds?: string[] })?.orgUnitIds);
  if (accessibleIds && !accessibleIds.includes(orgUnitId)) {
    return NextResponse.json({ error: "You do not have access to create an MRF under this org unit" }, { status: 403 });
  }

  const now = new Date();
  const id = newId();

  // Hierarchy-based self-approval skip: a creator who already outranks a
  // stage doesn't need sign-off from it — see computeInitialMrfState in
  // src/lib/mrf-approval.ts. Unranked creators (HR/Branch Manager/Admin/etc.)
  // get the unchanged full chain starting at PENDING_DIVISIONAL.
  const { status: initialStatus, skippedStages } = computeInitialMrfState(approvalLevel);
  const isImmediatelyApproved = initialStatus === "APPROVED";
  const assignedMrfNumber = isImmediatelyApproved ? await generateMRFNumber() : null;

  const [mrf] = await db("RECRUIT_T_MRF")
    .insert({
      id,
      // referenceNumber identifies the MRF from creation onward; mrfNumber
      // is a separate sequence assigned only once this MRF clears final
      // approval (see approve/route.ts) — or immediately here, if the
      // creator's own seniority skips every stage.
      referenceNumber: await generateReferenceNumber(),
      title,
      orgUnitId,
      departmentId,
      designationId: designationId || null,
      vacancyCount: vacancyCount || 1,
      justification,
      status: initialStatus,
      ...(isImmediatelyApproved ? { mrfNumber: assignedMrfNumber, approvedAt: now } : {}),
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
      // Printed on the requisition PDF's "Divisional Head" signature block
      // in place of that static label (see mrf-pdf-document.tsx) — entered
      // here at creation, not tied to any actual digital approval record.
      approvalSignatureName: body.approvalSignatureName || null,
      approvalSignatureDesignation: body.approvalSignatureDesignation || null,
      createdAt: now,
      updatedAt: now,
      // Stage-1 approvers are notified below, right at creation — the 3-day
      // reminder clock (src/lib/mrf-reminders.ts) starts from here, not from
      // whenever the query happens to run.
      lastReminderSentAt: now,
    })
    .returning("*");

  // Record the hierarchy skip as real approval-record rows so the Approval
  // Progress timeline and PDF signature blocks show it correctly (both
  // already key off RECRUIT_T_MRFApprovalRecord generically).
  await insertAutoApprovalRecords(db, id, skippedStages, { id: userId!, name: userName, role: userRole });

  const [department, creator] = await Promise.all([
    db("RECRUIT_T_Department").where({ id: departmentId }).first(),
    db("RECRUIT_T_User").where({ id: userId }).select("name").first(),
  ]);

  const orgUnitPath = getAncestorPath(orgUnitId, await getAllOrgUnits());

  const mrfWithRelations = {
    ...mrf,
    orgUnit: { id: orgUnitId, name: orgUnit.name, path: orgUnitPath.map((p) => p.name).join(" / ") },
    department: department || null,
    createdBy: creator ? { name: creator.name } : null,
  };

  // Notify whoever the chain actually starts at (may not be stage 1, if the
  // creator's own seniority skipped ahead) — same eligibility rules used to
  // authorize the approval itself (see src/lib/mrf-approval.ts). Nothing to
  // notify if the creator's seniority skipped every stage.
  if (!isImmediatelyApproved) {
    const scopedManagers = await getEligibleApprovers({ orgUnitId, departmentId }, STATUS_TO_APPROVAL_LEVELS[initialStatus] || []);
    await Promise.all(
      scopedManagers.map((mgr: any) =>
        db("RECRUIT_T_Notification").insert({
          id: newId(),
          userId: mgr.id,
          type: "MRF_APPROVAL",
          title: `New MRF ${mrf.referenceNumber} requires your approval`,
          message: `"${mrf.title}" has been submitted and is awaiting ${(STAGE_LEVEL_LABEL[initialStatus] || "").replace(/_/g, " ")} approval.`,
          link: `/dashboard/approvals`,
          createdAt: now,
        })
      )
    );
  }

  return NextResponse.json(mrfWithRelations, { status: 201 });
}
