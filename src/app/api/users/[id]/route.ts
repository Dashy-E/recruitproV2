import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myRole = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(myRole || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { name, email, password, userRole, branchId, countryId, isActive } = await req.json();

  // HR cannot promote someone to ADMIN
  if (myRole === "HR" && userRole === "ADMIN") {
    return NextResponse.json({ error: "HR cannot assign Admin role" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Only ADMIN can edit other ADMINs or change someone's role to ADMIN
  if (target.role === "ADMIN" && myRole !== "ADMIN") {
    return NextResponse.json({ error: "Only Admin can edit Admin users" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (userRole !== undefined) data.role = userRole;
  if (branchId !== undefined) data.branchId = branchId || null;
  if (countryId !== undefined) data.countryId = countryId || null;
  if (isActive !== undefined) data.isActive = isActive;
  if (password) data.password = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, branch: { select: { name: true } }, country: { select: { name: true } } },
  });

  return NextResponse.json(user);
}
