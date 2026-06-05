import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const designations = await prisma.designation.findMany({
    include: { department: true },
    orderBy: { title: "asc" },
  });
  return NextResponse.json(designations);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, departmentId, requiresPsychometric } = await req.json();
  const designation = await prisma.designation.create({
    data: { title, departmentId, requiresPsychometric: requiresPsychometric || false },
    include: { department: true },
  });
  return NextResponse.json(designation, { status: 201 });
}
