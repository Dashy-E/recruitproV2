import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";

async function attachRelations(employees: any[]) {
  if (!employees.length) return [];
  const candidateIds = employees.map((e) => e.candidateId);
  const branchIds = [...new Set(employees.map((e) => e.branchId).filter(Boolean))];

  const [candidates, branches] = await Promise.all([
    db("RECRUIT_T_Candidate").whereIn("id", candidateIds).select("id", "firstName", "lastName", "email", "phone", "mrfId"),
    db("RECRUIT_T_Branch").whereIn("id", branchIds).select("id", "name"),
  ]);

  const mrfIds = [...new Set(candidates.map((c: any) => c.mrfId).filter(Boolean))];
  const mrfs = mrfIds.length ? await db("RECRUIT_T_MRF").whereIn("id", mrfIds) : [];
  const departmentIds = [...new Set(mrfs.map((m: any) => m.departmentId).filter(Boolean))];
  const departments = departmentIds.length ? await db("RECRUIT_T_Department").whereIn("id", departmentIds) : [];

  return employees.map((e) => {
    const candidate = candidates.find((c: any) => c.id === e.candidateId);
    const mrf = candidate?.mrfId ? mrfs.find((m: any) => m.id === candidate.mrfId) : null;
    return {
      ...e,
      candidate: candidate
        ? {
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            email: candidate.email,
            phone: candidate.phone,
            mrf: mrf ? { ...mrf, department: departments.find((d: any) => d.id === mrf.departmentId) || null } : null,
          }
        : null,
      branch: (() => {
        const b = branches.find((x: any) => x.id === e.branchId);
        return b ? { name: b.name } : null;
      })(),
    };
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_EMPLOYEES")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const employees = await db("RECRUIT_T_Employee").orderBy("joiningDate", "desc");
  return NextResponse.json(await attachRelations(employees));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_EMPLOYEES")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { candidateId, joiningDate, department, designation, ctc, reportingTo, branchId } = await req.json();

  // Generate employee code
  const count = await db("RECRUIT_T_Employee").count<{ count: string }[]>("* as count").then((r) => Number(r[0].count));
  const employeeCode = `EMP-${String(count + 1).padStart(4, "0")}`;
  const now = new Date();

  const [employee] = await db("RECRUIT_T_Employee")
    .insert({
      id: newId(),
      candidateId,
      employeeCode,
      joiningDate: new Date(joiningDate),
      department,
      designation,
      ctc,
      reportingTo,
      branchId: branchId || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning("*");

  const [candidate, branch] = await Promise.all([
    db("RECRUIT_T_Candidate").where({ id: candidateId }).select("firstName", "lastName", "email").first(),
    branchId ? db("RECRUIT_T_Branch").where({ id: branchId }).select("name").first() : null,
  ]);

  return NextResponse.json({ ...employee, candidate: candidate || null, branch: branch || null }, { status: 201 });
}
