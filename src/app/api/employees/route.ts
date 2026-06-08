import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const employees = await prisma.employee.findMany({
    include: {
      candidate: { select: { firstName: true, lastName: true, email: true, phone: true, mrf: { include: { department: true } } } },
      branch: { select: { name: true } },
    },
    orderBy: { joiningDate: "desc" },
  });
  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { candidateId, joiningDate, department, designation, ctc, reportingTo, branchId } = await req.json();

  // Generate employee code
  const count = await prisma.employee.count();
  const employeeCode = `EMP-${String(count + 1).padStart(4, "0")}`;

  const employee = await prisma.employee.create({
    data: { candidateId, employeeCode, joiningDate: new Date(joiningDate), department, designation, ctc, reportingTo, branchId: branchId || null },
    include: { candidate: { select: { firstName: true, lastName: true, email: true } }, branch: { select: { name: true } } },
  });
  return NextResponse.json(employee, { status: 201 });
}
