import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      createdAt: true, branch: { select: { name: true } }, country: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, password, userRole, branchId, countryId, departmentId, divisionId } = await req.json();

  // HR cannot create ADMIN users
  if (role === "HR" && userRole === "ADMIN") {
    return NextResponse.json({ error: "HR cannot create Admin users" }, { status: 403 });
  }
  // Neither HR nor ADMIN should create CANDIDATE via this route (handled via candidate flow)
  if (userRole === "CANDIDATE") {
    return NextResponse.json({ error: "Use the candidate creation flow instead" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name, email, password: hashedPassword, role: userRole || "HR",
      branchId: branchId || null, countryId: countryId || null,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });

  // For FUNCTIONAL_HEAD, auto-create department mapping
  if (userRole === "FUNCTIONAL_HEAD" && departmentId) {
    await prisma.departmentFunctionalHead.create({
      data: {
        userId: user.id,
        departmentId,
        countryId: countryId || null,
      },
    }).catch(() => {});
  }

  return NextResponse.json(user, { status: 201 });
}
