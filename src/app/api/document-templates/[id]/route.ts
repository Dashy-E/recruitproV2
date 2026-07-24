import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { unlink } from "fs/promises";
import { join } from "path";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_DOCUMENTS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const template = await db("RECRUIT_T_DocumentTemplate").where({ id }).first();
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete physical file (best-effort)
  try {
    const relative = template.fileUrl.replace(/^\//, "");
    await unlink(join(process.cwd(), "public", relative));
  } catch { /* file may already be gone */ }

  await db("RECRUIT_T_DocumentTemplate").where({ id }).del();
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_DOCUMENTS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { name, description } = await req.json();

  const [template] = await db("RECRUIT_T_DocumentTemplate")
    .where({ id })
    .update({ name, description: description || null, updatedAt: new Date() })
    .returning("*");

  return NextResponse.json(template);
}
