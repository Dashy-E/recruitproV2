import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const mrfId = searchParams.get("mrfId");

  const candidates = await prisma.candidate.findMany({
    where: {
      ...(stage ? { currentStage: stage } : {}),
      ...(mrfId ? { mrfId } : {}),
    },
    include: {
      user: { select: { name: true, email: true } },
      mrf: { include: { department: true, branch: { include: { state: true, country: true } }, country: true } },
      stageHistory: { orderBy: { changedAt: "desc" } },
      employee: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(candidates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { firstName, lastName, email, phone, mrfId } = body;

  // Create user account for candidate
  const existingUser = await prisma.user.findUnique({ where: { email } });
  let userId = existingUser?.id;

  if (!existingUser) {
    const bcrypt = await import("bcryptjs");
    const tempPassword = Math.random().toString(36).slice(-8);
    const user = await prisma.user.create({
      data: {
        name: `${firstName} ${lastName}`,
        email,
        password: await bcrypt.hash(tempPassword, 10),
        role: "CANDIDATE",
      },
    });
    userId = user.id;
  }

  const candidate = await prisma.candidate.create({
    data: {
      userId: userId!,
      mrfId: mrfId || null,
      firstName,
      lastName,
      email,
      phone,
      currentStage: "APPLIED",
      stageHistory: {
        create: { toStage: "APPLIED", notes: "Candidate added to system" },
      },
    },
    include: { user: { select: { name: true } }, mrf: true },
  });

  return NextResponse.json(candidate, { status: 201 });
}
