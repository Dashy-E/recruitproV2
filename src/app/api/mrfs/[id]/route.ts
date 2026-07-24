import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { toBool } from "@/lib/db-bool";
import { hasPermission } from "@/lib/permissions";

const MRF_BOOLEAN_FIELDS = ["isNewRole", "isBusinessExpansion", "isBudgeted", "contributionJustified"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mrf = await db("RECRUIT_T_MRF").where({ id }).first();
  if (!mrf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [country, division, branch, department, designation, createdBy] = await Promise.all([
    mrf.countryId ? db("RECRUIT_T_Country").where({ id: mrf.countryId }).first() : null,
    mrf.divisionId ? db("RECRUIT_T_Division").where({ id: mrf.divisionId }).first() : null,
    mrf.branchId ? db("RECRUIT_T_Branch").where({ id: mrf.branchId }).first() : null,
    db("RECRUIT_T_Department").where({ id: mrf.departmentId }).first(),
    mrf.designationId ? db("RECRUIT_T_Designation").where({ id: mrf.designationId }).first() : null,
    db("RECRUIT_T_User").where({ id: mrf.createdById }).select("name", "email").first(),
  ]);

  const approvalRecordsRaw = await db("RECRUIT_T_MRFApprovalRecord")
    .where({ mrfId: id })
    .orderBy("recordedAt", "desc");
  const approverIds = [...new Set(approvalRecordsRaw.map((r: any) => r.approverId).filter(Boolean))];
  const documentIds = [...new Set(approvalRecordsRaw.map((r: any) => r.documentId).filter(Boolean))];
  const [approvers, approvalDocs] = await Promise.all([
    db("RECRUIT_T_User").whereIn("id", approverIds).select("id", "name"),
    db("RECRUIT_T_Document").whereIn("id", documentIds),
  ]);
  const approvalRecords = approvalRecordsRaw.map((r: any) => ({
    ...r,
    approver: r.approverId ? (() => {
      const a = approvers.find((x: any) => x.id === r.approverId);
      return a ? { name: a.name } : null;
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

  return NextResponse.json({
    ...mrf,
    country,
    division,
    branch,
    department,
    designation,
    createdBy,
    approvalRecords,
    candidates,
    documents,
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

  const data: Record<string, unknown> = { ...body, updatedAt: new Date() };
  for (const field of MRF_BOOLEAN_FIELDS) {
    if (data[field] !== undefined && data[field] !== null) data[field] = toBool(data[field] as boolean);
  }

  const [mrf] = await db("RECRUIT_T_MRF").where({ id }).update(data).returning("*");

  return NextResponse.json(mrf);
}
