import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";
import type { Session } from "next-auth";

async function canAccess(id: string, session: Session, role: string | undefined, userId: string | undefined) {
  if (role === "EMPLOYEE") {
    const employee = await db("RECRUIT_T_Employee").where({ id }).first();
    if (!employee) return false;
    const candidate = await db("RECRUIT_T_Candidate").where({ id: employee.candidateId }).select("userId").first();
    return candidate?.userId === userId;
  }
  return hasPermission(session, "MANAGE_EMPLOYEES");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;

  if (!(await canAccess(id, session, role, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await db("RECRUIT_T_EmployeeOnboardingData").where({ employeeId: id }).first();
  if (!data) return NextResponse.json(null);

  return NextResponse.json({ ...data, formData: JSON.parse(data.formData) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;

  if (!(await canAccess(id, session, role, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const formDataJson = JSON.stringify(body);
  const now = new Date();

  const existing = await db("RECRUIT_T_EmployeeOnboardingData").where({ employeeId: id }).first();
  let record;
  if (existing) {
    [record] = await db("RECRUIT_T_EmployeeOnboardingData")
      .where({ employeeId: id })
      .update({ formData: formDataJson, updatedAt: now })
      .returning("*");
  } else {
    [record] = await db("RECRUIT_T_EmployeeOnboardingData")
      .insert({ id: newId(), employeeId: id, formData: formDataJson, submittedAt: now, updatedAt: now })
      .returning("*");
  }

  return NextResponse.json({ ...record, formData: body }, { status: 201 });
}
