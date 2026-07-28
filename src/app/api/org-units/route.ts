import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_ORG")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const units = await db("RECRUIT_T_OrgUnit").orderBy("sortOrder", "asc");
    return NextResponse.json(units);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET /api/org-units error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_ORG")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, parentId } = await req.json();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  if (parentId) {
    const parent = await db("RECRUIT_T_OrgUnit").where({ id: parentId }).first();
    if (!parent) return NextResponse.json({ error: "Parent org unit not found" }, { status: 404 });
  }

  const now = new Date();
  const [unit] = await db("RECRUIT_T_OrgUnit")
    .insert({
      id: newId(),
      name,
      parentId: parentId || null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning("*");

  return NextResponse.json(unit, { status: 201 });
}
