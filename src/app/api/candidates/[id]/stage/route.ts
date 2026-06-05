import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CANDIDATE_STAGES } from "@/lib/utils";

const STAGE_KEYS = CANDIDATE_STAGES.map((s) => s.key);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { toStage, notes } = await req.json();

  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  const currentIdx = STAGE_KEYS.indexOf(candidate.currentStage as typeof STAGE_KEYS[number]);
  const targetIdx = STAGE_KEYS.indexOf(toStage as typeof STAGE_KEYS[number]);

  if (targetIdx <= currentIdx) {
    return NextResponse.json({ error: "Candidates can only move forward in the workflow." }, { status: 400 });
  }

  // Check if psychometric test should be skipped
  if (toStage === "PSYCHOMETRIC_TEST" && candidate.mrfId) {
    const mrf = await prisma.mRF.findUnique({
      where: { id: candidate.mrfId },
      include: { designation: true },
    });
    if (mrf?.designation && !mrf.designation.requiresPsychometric) {
      return NextResponse.json({ error: "Psychometric test not required for this designation. Skip to Offer." }, { status: 400 });
    }
  }

  const updated = await prisma.candidate.update({
    where: { id },
    data: {
      currentStage: toStage,
      stageHistory: {
        create: { fromStage: candidate.currentStage, toStage, notes },
      },
    },
  });

  return NextResponse.json(updated);
}
