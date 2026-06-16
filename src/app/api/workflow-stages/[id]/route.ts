import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM WorkflowStage WHERE id = ? LIMIT 1`, id
    );
    if (!rows.length) return NextResponse.json({ error: "Stage not found" }, { status: 404 });

    const updates: string[] = [];
    const values: any[] = [];
    if (body.isActive !== undefined) { updates.push("isActive = ?"); values.push(body.isActive ? 1 : 0); }
    if (body.stepOrder !== undefined) { updates.push("stepOrder = ?"); values.push(body.stepOrder); }
    if (body.label !== undefined) { updates.push("label = ?"); values.push(body.label); }

    if (updates.length) {
      updates.push("updatedAt = ?");
      values.push(new Date().toISOString());
      values.push(id);
      await prisma.$queryRawUnsafe(
        `UPDATE WorkflowStage SET ${updates.join(", ")} WHERE id = ?`,
        ...values
      );
    }

    const updated = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM WorkflowStage WHERE id = ? LIMIT 1`, id
    );
    return NextResponse.json(updated[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("PATCH workflow-stage error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
