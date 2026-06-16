import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, code, stateId, divisionId, countryId } = body;

  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  const updated = await prisma.branch.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(code !== undefined && { code: code.toUpperCase() }),
      ...(stateId !== undefined && { stateId: stateId || null }),
      ...(divisionId !== undefined && { divisionId: divisionId || null }),
      ...(countryId !== undefined && { countryId }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const [userCount, mrfCount] = await Promise.all([
    prisma.user.count({ where: { branchId: id } }),
    prisma.mRF.count({ where: { branchId: id } }),
  ]);

  if (userCount + mrfCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${userCount} user(s) and ${mrfCount} MRF(s) reference this branch.` },
      { status: 409 }
    );
  }

  await prisma.branch.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
