import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { fromBool } from "@/lib/db-bool";
import { getAllOrgUnits, getAncestorPath } from "@/lib/org-access";
import bcrypt from "bcryptjs";

// Self-service profile — any authenticated user, scoped to their own row.
// Deliberately separate from PATCH /api/users/[id] (MANAGE_USERS-gated):
// only name/email/password are accepted here, so username/role/department/
// org units/active-status stay admin-only no matter what a client sends.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id!;
  const row = await db("RECRUIT_T_User")
    .where({ id: userId })
    .select("id", "name", "userName", "email", "role", "isActive", "signatureUrl", "createdAt")
    .first();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [assignments, orgUnits, functionalHeadRow, roleRow] = await Promise.all([
    db("RECRUIT_T_UserOrgUnit").where({ userId }).select("orgUnitId"),
    getAllOrgUnits(),
    db("RECRUIT_T_DepartmentFunctionalHead").where({ userId }).select("departmentId").first(),
    db("RECRUIT_T_Role").where({ key: row.role }).select("label").first(),
  ]);

  const department = functionalHeadRow
    ? await db("RECRUIT_T_Department").where({ id: functionalHeadRow.departmentId }).select("name").first()
    : null;

  return NextResponse.json({
    id: row.id,
    name: row.name,
    userName: row.userName,
    email: row.email,
    role: row.role,
    roleLabel: roleRow?.label || row.role,
    isActive: fromBool(row.isActive),
    signatureUrl: row.signatureUrl || null,
    createdAt: row.createdAt,
    orgUnits: assignments.map((a: any) => {
      const path = getAncestorPath(a.orgUnitId, orgUnits);
      return { id: a.orgUnitId, name: path.at(-1)?.name ?? a.orgUnitId, path: path.map((p) => p.name).join(" / ") };
    }),
    departmentName: department?.name ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id!;
  const { name, email, password } = await req.json();

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) {
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    data.name = name;
  }
  if (email !== undefined) {
    if (!email?.trim()) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    const existing = await db("RECRUIT_T_User").where({ email }).whereNot({ id: userId }).first();
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    data.email = email;
  }
  if (password) {
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    data.password = await bcrypt.hash(password, 10);
  }

  try {
    await db("RECRUIT_T_User").where({ id: userId }).update(data);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("PATCH /api/users/me error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
