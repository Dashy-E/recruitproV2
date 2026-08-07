import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { fromBool } from "@/lib/db-bool";
import { hasPermission } from "@/lib/permissions";
import { getAllOrgUnits, getAncestorPath } from "@/lib/org-access";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_USERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db("RECRUIT_T_User")
    .select("id", "name", "userName", "email", "role", "isActive", "createdAt", "signatureUrl")
    .orderBy("createdAt", "desc");

  const [assignments, orgUnits, functionalHeadRows] = await Promise.all([
    db("RECRUIT_T_UserOrgUnit").select("userId", "orgUnitId"),
    getAllOrgUnits(),
    db("RECRUIT_T_DepartmentFunctionalHead").select("userId", "departmentId"),
  ]);

  const users = rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    userName: r.userName,
    email: r.email,
    role: r.role,
    isActive: fromBool(r.isActive),
    createdAt: r.createdAt,
    signatureUrl: r.signatureUrl || null,
    orgUnits: assignments
      .filter((a: any) => a.userId === r.id)
      .map((a: any) => {
        const path = getAncestorPath(a.orgUnitId, orgUnits);
        return { id: a.orgUnitId, name: path.at(-1)?.name ?? a.orgUnitId, path: path.map((p) => p.name).join(" / ") };
      }),
    // A user can technically be mapped to more than one department, but the
    // Add/Edit User UI only ever manages a single one — take the first.
    departmentId: functionalHeadRows.find((f: any) => f.userId === r.id)?.departmentId ?? null,
  }));

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!hasPermission(session, "MANAGE_USERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, userName, email, password, userRole, departmentId } = await req.json();

  // Only ADMIN can create ADMIN users
  if (role !== "ADMIN" && userRole === "ADMIN") {
    return NextResponse.json({ error: "Only Admin can create Admin users" }, { status: 403 });
  }
  // Neither HR nor ADMIN should create CANDIDATE via this route (handled via candidate flow)
  if (userRole === "CANDIDATE") {
    return NextResponse.json({ error: "Use the candidate creation flow instead" }, { status: 400 });
  }

  const [existingUserName, existingEmail] = await Promise.all([
    db("RECRUIT_T_User").where({ userName }).first(),
    db("RECRUIT_T_User").where({ email }).first(),
  ]);
  if (existingUserName) return NextResponse.json({ error: "Username already in use" }, { status: 409 });
  if (existingEmail) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const hashedPassword = await bcrypt.hash(password, 10);
  const now = new Date();

  const [user] = await db("RECRUIT_T_User")
    .insert({
      id: newId(),
      name,
      userName,
      email,
      password: hashedPassword,
      role: userRole || "HR",
      createdAt: now,
      updatedAt: now,
    })
    // NOTE: passing an explicit column array to .returning() returns
    // un-coerced values (raw NUMBER for booleans, native Oracle date
    // strings) under this Knex/oracledb combination — .returning("*") does
    // not have this problem, so fetch everything and strip the password.
    .returning("*");

  // For FUNCTIONAL_HEAD, auto-create department mapping
  if (userRole === "FUNCTIONAL_HEAD" && departmentId) {
    await db("RECRUIT_T_DepartmentFunctionalHead")
      .insert({ id: newId(), userId: user.id, departmentId })
      .catch(() => {});
  }

  const { password: _password, ...userWithoutPassword } = user;
  return NextResponse.json({ ...userWithoutPassword, isActive: fromBool(user.isActive) }, { status: 201 });
}
