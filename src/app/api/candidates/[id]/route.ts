import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { fromBool, toBool } from "@/lib/db-bool";
import { hasPermission } from "@/lib/permissions";
import bcrypt from "bcryptjs";

const CANDIDATE_BOOLEAN_FIELDS = ["isActive"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const candidate = await db("RECRUIT_T_Candidate").where({ id }).first();
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Candidates can only see their own profile
  const role = (session.user as { role?: string })?.role;
  const sessionUserId = (session.user as { id?: string })?.id;
  if (role === "CANDIDATE" && candidate.userId !== sessionUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await db("RECRUIT_T_User").where({ id: candidate.userId }).select("name", "email").first();

  let mrf = null;
  if (candidate.mrfId) {
    const mrfRow = await db("RECRUIT_T_MRF").where({ id: candidate.mrfId }).first();
    if (mrfRow) {
      const [department, branch, country, division, designation, createdBy, approvalRecords] = await Promise.all([
        db("RECRUIT_T_Department").where({ id: mrfRow.departmentId }).first(),
        mrfRow.branchId ? db("RECRUIT_T_Branch").where({ id: mrfRow.branchId }).first() : null,
        mrfRow.countryId ? db("RECRUIT_T_Country").where({ id: mrfRow.countryId }).select("name").first() : null,
        mrfRow.divisionId ? db("RECRUIT_T_Division").where({ id: mrfRow.divisionId }).select("name").first() : null,
        mrfRow.designationId
          ? db("RECRUIT_T_Designation").where({ id: mrfRow.designationId }).select("requiresPsychometric").first()
          : null,
        db("RECRUIT_T_User").where({ id: mrfRow.createdById }).select("name").first(),
        db("RECRUIT_T_MRFApprovalRecord").where({ mrfId: mrfRow.id }).orderBy("recordedAt", "asc"),
      ]);
      mrf = {
        ...mrfRow,
        department,
        branch,
        country,
        division,
        designation: designation ? { requiresPsychometric: fromBool(designation.requiresPsychometric) } : null,
        createdBy,
        approvalRecords,
      };
    }
  }

  const stageHistory = await db("RECRUIT_T_CandidateStageHistory")
    .where({ candidateId: id })
    .orderBy("changedAt", "asc");

  const interviewsRaw = await db("RECRUIT_T_InterviewRecord")
    .where({ candidateId: id })
    .orderBy("scheduledAt", "desc");
  const interviewerIds = [...new Set(interviewsRaw.map((i: any) => i.interviewerId))];
  const interviewers = interviewerIds.length
    ? await db("RECRUIT_T_User").whereIn("id", interviewerIds).select("id", "name")
    : [];
  const interviews = interviewsRaw.map((i: any) => ({
    ...i,
    interviewer: (() => {
      const u = interviewers.find((x: any) => x.id === i.interviewerId);
      return u ? { name: u.name } : null;
    })(),
  }));

  const documentsRaw = await db("RECRUIT_T_Document")
    .where({ candidateId: id })
    .orderBy("createdAt", "desc");
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

  const offerDetail = await db("RECRUIT_T_OfferDetail").where({ candidateId: id }).first();

  return NextResponse.json({
    ...candidate,
    isActive: fromBool(candidate.isActive),
    user,
    mrf,
    stageHistory,
    interviews,
    documents,
    offerDetail: offerDetail || null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_CANDIDATES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { newPassword, ...candidateData } = body;

  const data: Record<string, unknown> = { ...candidateData, updatedAt: new Date() };
  for (const field of CANDIDATE_BOOLEAN_FIELDS) {
    if (data[field] !== undefined) data[field] = toBool(data[field] as boolean);
  }

  const [candidate] = await db("RECRUIT_T_Candidate").where({ id }).update(data).returning("*");

  if (newPassword) {
    await db("RECRUIT_T_User")
      .where({ id: candidate.userId })
      .update({ password: await bcrypt.hash(newPassword, 10), updatedAt: new Date() });
  }

  return NextResponse.json(candidate);
}
