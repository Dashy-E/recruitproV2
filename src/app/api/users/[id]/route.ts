import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { toBool, fromBool } from "@/lib/db-bool";
import { hasPermission } from "@/lib/permissions";
import { getAllOrgUnits, getAncestorPath } from "@/lib/org-access";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myRole = (session.user as { role?: string })?.role;
  if (!hasPermission(session, "MANAGE_USERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { name, userName, email, password, userRole, isActive } = await req.json();

  // Only ADMIN can promote someone to ADMIN
  if (myRole !== "ADMIN" && userRole === "ADMIN") {
    return NextResponse.json({ error: "Only Admin can assign the Admin role" }, { status: 403 });
  }

  const target = await db("RECRUIT_T_User").where({ id }).first();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Only ADMIN can edit other ADMINs or change someone's role to ADMIN
  if (target.role === "ADMIN" && myRole !== "ADMIN") {
    return NextResponse.json({ error: "Only Admin can edit Admin users" }, { status: 403 });
  }

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) data.name = name;
  if (userName !== undefined) data.userName = userName;
  if (email !== undefined) data.email = email;
  if (userRole !== undefined) data.role = userRole;
  if (isActive !== undefined) data.isActive = toBool(isActive);
  if (password) data.password = await bcrypt.hash(password, 10);

  try {
    await db("RECRUIT_T_User").where({ id }).update(data);

    const row = await db("RECRUIT_T_User")
      .where({ id })
      .select("id", "name", "userName", "email", "role", "isActive", "createdAt")
      .first();

    const [assignments, orgUnits] = await Promise.all([
      db("RECRUIT_T_UserOrgUnit").where({ userId: id }).select("orgUnitId"),
      getAllOrgUnits(),
    ]);

    return NextResponse.json({
      id: row.id,
      name: row.name,
      userName: row.userName,
      email: row.email,
      role: row.role,
      isActive: fromBool(row.isActive),
      createdAt: row.createdAt,
      orgUnits: assignments.map((a: any) => {
        const path = getAncestorPath(a.orgUnitId, orgUnits);
        return { id: a.orgUnitId, name: path.at(-1)?.name ?? a.orgUnitId, path: path.map((p) => p.name).join(" / ") };
      }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("PATCH /api/users/[id] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
