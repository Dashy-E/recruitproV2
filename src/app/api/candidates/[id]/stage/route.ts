import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_CANDIDATES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { toStage, notes } = await req.json();

  if (!toStage) return NextResponse.json({ error: "toStage is required" }, { status: 400 });

  // Load active stages from DB in order
  const stages = await db("RECRUIT_T_WorkflowStage").where({ isActive: 1 }).orderBy("stepOrder", "asc");
  const stageKeys = stages.map((s: any) => s.key);

  const candidate = await db("RECRUIT_T_Candidate").where({ id }).first();
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  if (!stageKeys.includes(toStage)) {
    return NextResponse.json({ error: "Invalid or inactive stage." }, { status: 400 });
  }

  if (toStage === candidate.currentStage) {
    return NextResponse.json({ error: "Candidate is already at this stage." }, { status: 400 });
  }

  const now = new Date();

  await db.transaction(async (trx) => {
    await trx("RECRUIT_T_Candidate")
      .where({ id })
      .update({ currentStage: toStage, updatedAt: now });

    await trx("RECRUIT_T_CandidateStageHistory").insert({
      id: newId(),
      candidateId: id,
      fromStage: candidate.currentStage,
      toStage,
      notes,
      changedAt: now,
    });
  });

  const updated = await db("RECRUIT_T_Candidate").where({ id }).first();

  return NextResponse.json(updated);
}
