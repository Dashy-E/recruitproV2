import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;

  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { candidate: { select: { userId: true } } },
    });
    if (!employee || employee.candidate.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await prisma.employeeOnboardingData.findUnique({ where: { employeeId: id } });
  if (!data) return NextResponse.json(null);

  return NextResponse.json({ ...data, formData: JSON.parse(data.formData) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;

  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { candidate: { select: { userId: true } } },
    });
    if (!employee || employee.candidate.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const formDataJson = JSON.stringify(body);

  const record = await prisma.employeeOnboardingData.upsert({
    where: { employeeId: id },
    create: { employeeId: id, formData: formDataJson },
    update: { formData: formDataJson },
  });

  return NextResponse.json({ ...record, formData: body }, { status: 201 });
}