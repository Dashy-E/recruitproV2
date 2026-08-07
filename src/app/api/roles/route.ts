import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { fromBool } from "@/lib/db-bool";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";

async function attachPermissions(roles: any[]) {
  if (!roles.length) return [];
  const roleIds = roles.map((r) => r.id);
  const rows = await db("RECRUIT_T_RolePermission").whereIn("roleId", roleIds).select("roleId", "permissionKey");
  return roles.map((r) => ({
    ...r,
    isSystem: fromBool(r.isSystem),
    isActive: fromBool(r.isActive),
    permissions: rows.filter((p: any) => p.roleId === r.id).map((p: any) => p.permissionKey),
  }));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = await db("RECRUIT_T_Role").orderBy("label", "asc");
  return NextResponse.json(await attachPermissions(roles));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_ROLES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { key, label, approvalLevel, permissions } = await req.json();

  if (!key?.trim() || !label?.trim()) {
    return NextResponse.json({ error: "Key and label are required" }, { status: 400 });
  }
  if (approvalLevel && !["DIVISIONAL", "FUNCTIONAL", "COUNTRY", "COUNTRY_SUPERVISOR", "ANY"].includes(approvalLevel)) {
    return NextResponse.json({ error: "Invalid approval level" }, { status: 400 });
  }
  const permissionKeys: string[] = Array.isArray(permissions) ? permissions : [];
  const invalid = permissionKeys.filter((p) => !(p in PERMISSIONS));
  if (invalid.length) {
    return NextResponse.json({ error: `Unknown permission(s): ${invalid.join(", ")}` }, { status: 400 });
  }

  const normalizedKey = key.trim().toUpperCase().replace(/\s+/g, "_");
  const existing = await db("RECRUIT_T_Role").where({ key: normalizedKey }).first();
  if (existing) return NextResponse.json({ error: "A role with this key already exists" }, { status: 409 });

  const now = new Date();
  const roleId = newId();

  await db.transaction(async (trx) => {
    await trx("RECRUIT_T_Role").insert({
      id: roleId,
      key: normalizedKey,
      label: label.trim(),
      approvalLevel: approvalLevel || null,
      isSystem: 0,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });
    if (permissionKeys.length) {
      await trx("RECRUIT_T_RolePermission").insert(
        permissionKeys.map((permissionKey) => ({ id: newId(), roleId, permissionKey }))
      );
    }
  });

  const role = await db("RECRUIT_T_Role").where({ id: roleId }).first();
  const [withPerms] = await attachPermissions([role]);
  return NextResponse.json(withPerms, { status: 201 });
}
