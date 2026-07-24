import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { toBool } from "@/lib/db-bool";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const designations = await db("RECRUIT_T_Designation").orderBy("title", "asc");
  const deptIds = [...new Set(designations.map((d: any) => d.departmentId))];
  const departments = deptIds.length
    ? await db("RECRUIT_T_Department").whereIn("id", deptIds)
    : [];

  const result = designations.map((d: any) => ({
    ...d,
    department: departments.find((dep: any) => dep.id === d.departmentId) || null,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_ORG")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, departmentId, requiresPsychometric } = await req.json();
  const now = new Date();
  const [designation] = await db("RECRUIT_T_Designation")
    .insert({
      id: newId(),
      title,
      departmentId,
      requiresPsychometric: toBool(requiresPsychometric),
      createdAt: now,
      updatedAt: now,
    })
    .returning("*");

  const department = await db("RECRUIT_T_Department").where({ id: departmentId }).first();

  return NextResponse.json({ ...designation, department }, { status: 201 });
}
