import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;

  // Employees can only advance their own onboardingStep
  if (role === "EMPLOYEE") {
    const candidate = await prisma.candidate.findFirst({ where: { userId } });
    const employee = candidate ? await prisma.employee.findUnique({ where: { candidateId: candidate.id } }) : null;
    if (!employee || employee.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { onboardingStep } = await req.json();
    if (typeof onboardingStep !== "number") {
      return NextResponse.json({ error: "onboardingStep must be a number" }, { status: 400 });
    }
    const updated = await prisma.employee.update({ where: { id }, data: { onboardingStep } });
    return NextResponse.json(updated);
  }

  // Admin/HR can update any employee fields
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updated = await prisma.employee.update({
    where: { id },
    data: body,
    include: {
      candidate: { select: { firstName: true, lastName: true, email: true } },
      branch: { select: { name: true } },
    },
  });
  return NextResponse.json(updated);
}
