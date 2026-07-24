import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const stages = await db("RECRUIT_T_WorkflowStage").orderBy("stepOrder", "asc");
    return NextResponse.json(stages);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET /api/workflow-stages error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
