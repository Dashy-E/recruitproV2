import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const stages = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM WorkflowStage ORDER BY stepOrder ASC`
    );
    return NextResponse.json(stages);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET /api/workflow-stages error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
