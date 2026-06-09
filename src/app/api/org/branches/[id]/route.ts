import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Prevent deletion if branch has users or MRFs linked
  const userCount = await prisma.user.count({ where: { branchId: id } });
  if (userCount > 0) {
    return NextResponse.json({ error: `Cannot delete: ${userCount} user(s) are assigned to this branch.` }, { status: 409 });
  }
  const mrfCount = await prisma.mRF.count({ where: { branchId: id } });
  if (mrfCount > 0) {
    return NextResponse.json({ error: `Cannot delete: ${mrfCount} MRF(s) reference this branch.` }, { status: 409 });
  }

  await prisma.branch.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
