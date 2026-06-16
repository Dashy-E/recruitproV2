import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { toStage, notes } = await req.json();

  if (!toStage) return NextResponse.json({ error: "toStage is required" }, { status: 400 });

  // Load active stages from DB in order
  const stages = await prisma.workflowStage.findMany({
    where: { isActive: true },
    orderBy: { stepOrder: "asc" },
  });
  const stageKeys = stages.map((s) => s.key);

  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  if (!stageKeys.includes(toStage)) {
    return NextResponse.json({ error: "Invalid or inactive stage." }, { status: 400 });
  }

  if (toStage === candidate.currentStage) {
    return NextResponse.json({ error: "Candidate is already at this stage." }, { status: 400 });
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
