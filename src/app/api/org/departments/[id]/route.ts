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

  try {
    const mrfCount = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as count FROM MRF WHERE departmentId = ?`, id
    );
    if (mrfCount[0]?.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${mrfCount[0].count} MRF(s) are linked to this department.` },
        { status: 409 }
      );
    }

    const desigCount = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as count FROM Designation WHERE departmentId = ?`, id
    );
    if (desigCount[0]?.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${desigCount[0].count} designation(s) belong to this department. Delete them first.` },
        { status: 409 }
      );
    }

    await prisma.$queryRawUnsafe(`DELETE FROM Department WHERE id = ?`, id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
