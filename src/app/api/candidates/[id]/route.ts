import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      mrf: {
        include: {
          department: true,
          branch: true,
          designation: { select: { requiresPsychometric: true } },
        },
      },
      stageHistory: { orderBy: { changedAt: "desc" } },
      interviews: { include: { interviewer: { select: { name: true } } }, orderBy: { scheduledAt: "desc" } },
      documents: { include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      offerDetail: true,
    },
  });

  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Candidates can only see their own profile
  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;
  if (role === "CANDIDATE" && candidate.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(candidate);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { newPassword, ...candidateData } = body;

  const candidate = await prisma.candidate.update({ where: { id }, data: candidateData });

  if (newPassword) {
    const bcrypt = await import("bcryptjs");
    await prisma.user.update({
      where: { id: candidate.userId },
      data: { password: await bcrypt.hash(newPassword, 10) },
    });
  }

  return NextResponse.json(candidate);
}
