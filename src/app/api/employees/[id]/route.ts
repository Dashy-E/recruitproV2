import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { getAllOrgUnits, getAncestorPath } from "@/lib/org-access";

// Mirrors /api/employees/me's response shape, but by explicit employee id —
// used by the Employee Portal page when an Admin/HR (MANAGE_EMPLOYEES) user
// is viewing/filling a specific employee's portal on their behalf, rather
// than the always-"my own record" /me route.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const employeeRow = await db("RECRUIT_T_Employee").where({ id }).first();
  if (!employeeRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;
  if (role === "EMPLOYEE") {
    const ownCandidate = await db("RECRUIT_T_Candidate").where({ userId }).first();
    if (!ownCandidate || ownCandidate.id !== employeeRow.candidateId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!hasPermission(session, "MANAGE_EMPLOYEES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const candidate = await db("RECRUIT_T_Candidate").where({ id: employeeRow.candidateId }).first();
  let mrf = null;
  if (candidate?.mrfId) {
    const mrfRow = await db("RECRUIT_T_MRF").where({ id: candidate.mrfId }).first();
    if (mrfRow) {
      const department = await db("RECRUIT_T_Department").where({ id: mrfRow.departmentId }).first();
      mrf = { ...mrfRow, department };
    }
  }

  const employee = {
    ...employeeRow,
    candidate: candidate
      ? {
          id: candidate.id,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
          currentStage: candidate.currentStage,
          recruitmentEntity: candidate.recruitmentEntity,
          mrf,
        }
      : null,
  };

  const documents = await db("RECRUIT_T_Document")
    .where({ candidateId: employeeRow.candidateId })
    .select("id", "name", "fileUrl", "fileType", "fileSize", "documentType", "approvalStatus", "extractedData", "createdAt")
    .orderBy("createdAt", "desc");

  return NextResponse.json({ employee, documents });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;

  // Employees can update their own onboardingStep or employeeType
  if (role === "EMPLOYEE") {
    const candidate = await db("RECRUIT_T_Candidate").where({ userId }).first();
    const employee = candidate ? await db("RECRUIT_T_Employee").where({ candidateId: candidate.id }).first() : null;
    if (!employee || employee.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const allowedFields: Record<string, unknown> = {};
    if (typeof body.onboardingStep === "number") allowedFields.onboardingStep = body.onboardingStep;
    if (body.employeeType === "INDIA" || body.employeeType === "OVERSEAS") {
      allowedFields.employeeType = body.employeeType;
    }
    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
    allowedFields.updatedAt = new Date();
    // NOTE: .returning("*") on UPDATE can hit an Oracle/oracledb bind-count
    // mismatch (NJS-098) — see the same fix on the MRF/Candidate PATCH
    // routes. Plain update + re-select sidesteps it.
    await db("RECRUIT_T_Employee").where({ id }).update(allowedFields);
    const updated = await db("RECRUIT_T_Employee").where({ id }).first();
    return NextResponse.json(updated);
  }

  // Admin/HR (or any role with MANAGE_EMPLOYEES) can update any employee fields
  if (!hasPermission(session, "MANAGE_EMPLOYEES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  await db("RECRUIT_T_Employee").where({ id }).update({ ...body, updatedAt: new Date() });
  const updated = await db("RECRUIT_T_Employee").where({ id }).first();

  const [candidate, orgUnits] = await Promise.all([
    db("RECRUIT_T_Candidate").where({ id: updated.candidateId }).select("firstName", "lastName", "email").first(),
    getAllOrgUnits(),
  ]);
  const orgUnitPath = updated.orgUnitId ? getAncestorPath(updated.orgUnitId, orgUnits) : [];

  return NextResponse.json({
    ...updated,
    candidate: candidate || null,
    orgUnit: orgUnitPath.length ? { id: updated.orgUnitId, name: orgUnitPath.at(-1)!.name, path: orgUnitPath.map((p) => p.name).join(" / ") } : null,
  });
}
