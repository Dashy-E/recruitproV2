import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { toBool, fromBool } from "@/lib/db-bool";
import { hasPermission } from "@/lib/permissions";
import { getAllOrgUnits, getAncestorPath, getAccessibleOrgUnitIds } from "@/lib/org-access";
import { isDesignatedApproverForStage } from "@/lib/mrf-approval";

const MRF_BOOLEAN_FIELDS = ["isNewRole", "isBusinessExpansion", "isBudgeted", "contributionJustified"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mrf = await db("RECRUIT_T_MRF").where({ id }).first();
  if (!mrf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const accessibleIds = await getAccessibleOrgUnitIds((session.user as { orgUnitIds?: string[] })?.orgUnitIds);
  if (accessibleIds && !accessibleIds.includes(mrf.orgUnitId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgUnits = await getAllOrgUnits();
  const orgUnitPath = getAncestorPath(mrf.orgUnitId, orgUnits);

  // Whether the requesting user is genuinely the designated approver for
  // this MRF's current stage (org/department-scoped, excludes the ANY
  // universal-approver bypass which the client already knows about from its
  // own session) — drives whether the frontend shows the Approve button, so
  // the two never fall out of sync the way a client-only approvalLevel
  // check could (see src/lib/mrf-approval.ts).
  const approvalLevel = (session.user as { approvalLevel?: string | null })?.approvalLevel ?? null;
  const requestingUserId = (session.user as { id?: string })?.id!;
  const canApprove = await isDesignatedApproverForStage(requestingUserId, approvalLevel as any, mrf);

  const [department, designation, createdBy, heldBy] = await Promise.all([
    db("RECRUIT_T_Department").where({ id: mrf.departmentId }).first(),
    mrf.designationId ? db("RECRUIT_T_Designation").where({ id: mrf.designationId }).first() : null,
    db("RECRUIT_T_User").where({ id: mrf.createdById }).select("name", "email", "signatureUrl").first(),
    mrf.heldById ? db("RECRUIT_T_User").where({ id: mrf.heldById }).select("name").first() : null,
  ]);

  // Computed here (not left to the client) so "is this actually on hold
  // right now" can't drift from what src/lib/mrf-reminders.ts uses to decide
  // whether to send the next reminder.
  const holdIndefinite = fromBool(mrf.holdIndefinite);
  const isOnHold = holdIndefinite || (!!mrf.holdUntil && new Date(mrf.holdUntil).getTime() > Date.now());

  const approvalRecordsRaw = await db("RECRUIT_T_MRFApprovalRecord")
    .where({ mrfId: id })
    .orderBy("recordedAt", "desc");
  const approverIds = [...new Set(approvalRecordsRaw.map((r: any) => r.approverId).filter(Boolean))];
  const documentIds = [...new Set(approvalRecordsRaw.map((r: any) => r.documentId).filter(Boolean))];
  const [approvers, approvalDocs] = await Promise.all([
    db("RECRUIT_T_User").whereIn("id", approverIds).select("id", "name", "signatureUrl"),
    db("RECRUIT_T_Document").whereIn("id", documentIds),
  ]);
  const approvalRecords = approvalRecordsRaw.map((r: any) => ({
    ...r,
    isAutoApproved: fromBool(r.isAutoApproved),
    approver: r.approverId ? (() => {
      const a = approvers.find((x: any) => x.id === r.approverId);
      return a ? { name: a.name, signatureUrl: a.signatureUrl || null } : null;
    })() : null,
    document: r.documentId ? approvalDocs.find((d: any) => d.id === r.documentId) || null : null,
  }));

  const candidatesRaw = await db("RECRUIT_T_Candidate").where({ mrfId: id });
  const candidateUserIds = candidatesRaw.map((c: any) => c.userId);
  const candidateUsers = candidateUserIds.length
    ? await db("RECRUIT_T_User").whereIn("id", candidateUserIds).select("id", "name", "email")
    : [];
  const candidates = candidatesRaw.map((c: any) => ({
    ...c,
    user: (() => {
      const u = candidateUsers.find((x: any) => x.id === c.userId);
      return u ? { name: u.name, email: u.email } : null;
    })(),
  }));

  const documentsRaw = await db("RECRUIT_T_Document").where({ mrfId: id });
  const uploaderIds = [...new Set(documentsRaw.map((d: any) => d.uploadedById).filter(Boolean))];
  const uploaders = uploaderIds.length
    ? await db("RECRUIT_T_User").whereIn("id", uploaderIds).select("id", "name")
    : [];
  const documents = documentsRaw.map((d: any) => ({
    ...d,
    uploadedBy: (() => {
      const u = uploaders.find((x: any) => x.id === d.uploadedById);
      return u ? { name: u.name } : null;
    })(),
  }));

  // Oracle has no native boolean type — these columns come back as raw
  // NUMBER(1) (0/1), not real booleans, so anything doing a strict ===
  // true/false comparison downstream (e.g. the PDF's Budgeted Y/N
  // checkboxes) would never match. isBudgeted is nullable/tri-state
  // (unset/true/false), so null must stay null rather than collapse to false.
  const booleanFields: Record<string, boolean | null> = {};
  for (const field of MRF_BOOLEAN_FIELDS) {
    booleanFields[field] = mrf[field] === null || mrf[field] === undefined ? null : fromBool(mrf[field]);
  }

  return NextResponse.json({
    ...mrf,
    ...booleanFields,
    orgUnit: orgUnitPath.length ? { id: mrf.orgUnitId, name: orgUnitPath.at(-1)!.name, path: orgUnitPath.map((p) => p.name).join(" / ") } : null,
    department,
    designation,
    createdBy,
    approvalRecords,
    candidates,
    documents,
    canApprove,
    isOnHold,
    holdIndefinite,
    heldBy: heldBy ? { name: heldBy.name } : null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_MRF")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  if (body.orgUnitId) {
    const orgUnit = await db("RECRUIT_T_OrgUnit").where({ id: body.orgUnitId }).first();
    if (!orgUnit) return NextResponse.json({ error: "Org unit not found" }, { status: 404 });

    const childCount = await db("RECRUIT_T_OrgUnit")
      .where({ parentId: body.orgUnitId })
      .count<{ count: string }[]>("* as count")
      .then((r) => Number(r[0].count));
    if (childCount > 0) {
      return NextResponse.json({ error: "Please select a specific location — this org unit has sub-locations under it" }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = { ...body, updatedAt: new Date() };
  for (const field of MRF_BOOLEAN_FIELDS) {
    if (data[field] !== undefined && data[field] !== null) data[field] = toBool(data[field] as boolean);
  }

  const [mrf] = await db("RECRUIT_T_MRF").where({ id }).update(data).returning("*");

  return NextResponse.json(mrf);
}
