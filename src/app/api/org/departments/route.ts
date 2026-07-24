import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const departments = await db("RECRUIT_T_Department").orderBy("name", "asc");
  const deptIds = departments.map((d: any) => d.id);

  const designations = deptIds.length
    ? await db("RECRUIT_T_Designation").whereIn("departmentId", deptIds).orderBy("title", "asc")
    : [];

  const mrfCounts = deptIds.length
    ? await db("RECRUIT_T_MRF")
        .whereIn("departmentId", deptIds)
        .groupBy("departmentId")
        .select("departmentId")
        .count({ count: "*" })
    : [];

  const result = departments.map((dept: any) => ({
    ...dept,
    designations: designations.filter((d: any) => d.departmentId === dept.id),
    _count: {
      mrfs: Number(mrfCounts.find((c: any) => c.departmentId === dept.id)?.count || 0),
    },
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_ORG")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name } = await req.json();
  const now = new Date();
  const [department] = await db("RECRUIT_T_Department")
    .insert({ id: newId(), name, createdAt: now, updatedAt: now })
    .returning("*");
  return NextResponse.json(department, { status: 201 });
}
