import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { fromBool, toBool } from "@/lib/db-bool";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_ROLES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const role = await db("RECRUIT_T_Role").where({ id }).first();
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  // The ADMIN role is always full-access — editing it risks locking every
  // admin out of the system, so it's read-only via this API.
  if (role.key === "ADMIN") {
    return NextResponse.json({ error: "The Admin role cannot be modified" }, { status: 403 });
  }

  const { label, approvalLevel, isActive, permissions } = await req.json();

  if (approvalLevel !== undefined && approvalLevel !== null && !["DIVISIONAL", "FUNCTIONAL", "COUNTRY", "COUNTRY_SUPERVISOR", "ANY"].includes(approvalLevel)) {
    return NextResponse.json({ error: "Invalid approval level" }, { status: 400 });
  }
  let permissionKeys: string[] | undefined;
  if (permissions !== undefined) {
    permissionKeys = Array.isArray(permissions) ? permissions : [];
    const invalid = permissionKeys.filter((p) => !(p in PERMISSIONS));
    if (invalid.length) {
      return NextResponse.json({ error: `Unknown permission(s): ${invalid.join(", ")}` }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (label !== undefined) data.label = label;
  if (approvalLevel !== undefined) data.approvalLevel = approvalLevel || null;
  if (isActive !== undefined) data.isActive = toBool(isActive);

  await db.transaction(async (trx) => {
    if (Object.keys(data).length) {
      await trx("RECRUIT_T_Role").where({ id }).update(data);
    }
    if (permissionKeys !== undefined) {
      await trx("RECRUIT_T_RolePermission").where({ roleId: id }).del();
      if (permissionKeys.length) {
        await trx("RECRUIT_T_RolePermission").insert(
          permissionKeys.map((permissionKey) => ({ id: newId(), roleId: id, permissionKey }))
        );
      }
    }
  });

  const updated = await db("RECRUIT_T_Role").where({ id }).first();
  const permRows = await db("RECRUIT_T_RolePermission").where({ roleId: id }).select("permissionKey");

  return NextResponse.json({
    ...updated,
    isSystem: fromBool(updated.isSystem),
    isActive: fromBool(updated.isActive),
    permissions: permRows.map((p: any) => p.permissionKey),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_ROLES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const role = await db("RECRUIT_T_Role").where({ id }).first();
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  if (fromBool(role.isSystem)) {
    return NextResponse.json({ error: "Built-in roles cannot be deleted" }, { status: 403 });
  }

  const userCount = await db("RECRUIT_T_User")
    .where({ role: role.key })
    .count<{ count: string }[]>("* as count")
    .then((r) => Number(r[0].count));
  if (userCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${userCount} user(s) currently have this role.` },
      { status: 409 }
    );
  }

  await db("RECRUIT_T_Role").where({ id }).del();
  return NextResponse.json({ success: true });
}
