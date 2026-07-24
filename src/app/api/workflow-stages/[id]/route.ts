import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { toBool } from "@/lib/db-bool";
import { hasPermission } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_SETTINGS")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  try {
    const stage = await db("RECRUIT_T_WorkflowStage").where({ id }).first();
    if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (body.isActive !== undefined) updates.isActive = toBool(body.isActive);
    if (body.stepOrder !== undefined) updates.stepOrder = body.stepOrder;
    if (body.label !== undefined) updates.label = body.label;

    if (Object.keys(updates).length) {
      updates.updatedAt = new Date();
      await db("RECRUIT_T_WorkflowStage").where({ id }).update(updates);
    }

    const updated = await db("RECRUIT_T_WorkflowStage").where({ id }).first();
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("PATCH workflow-stage error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
