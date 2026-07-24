import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

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
    const [updated] = await db("RECRUIT_T_Employee").where({ id }).update(allowedFields).returning("*");
    return NextResponse.json(updated);
  }

  // Admin/HR (or any role with MANAGE_EMPLOYEES) can update any employee fields
  if (!hasPermission(session, "MANAGE_EMPLOYEES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const [updated] = await db("RECRUIT_T_Employee")
    .where({ id })
    .update({ ...body, updatedAt: new Date() })
    .returning("*");

  const [candidate, branch] = await Promise.all([
    db("RECRUIT_T_Candidate").where({ id: updated.candidateId }).select("firstName", "lastName", "email").first(),
    updated.branchId ? db("RECRUIT_T_Branch").where({ id: updated.branchId }).select("name").first() : null,
  ]);

  return NextResponse.json({ ...updated, candidate: candidate || null, branch: branch || null });
}
