import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, code, locationType } = body;

  const country = await prisma.country.findUnique({ where: { id } });
  if (!country) return NextResponse.json({ error: "Country not found" }, { status: 404 });

  const updated = await prisma.country.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(code && { code: code.toUpperCase() }),
      ...(locationType && { locationType }),
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

  // Block deletion if any branches, MRFs, or users are linked
  const [branchCount, mrfCount, userCount] = await Promise.all([
    prisma.branch.count({ where: { countryId: id } }),
    prisma.mRF.count({ where: { countryId: id } }),
    prisma.user.count({ where: { countryId: id } }),
  ]);

  if (branchCount + mrfCount + userCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: country has ${branchCount} branch(es), ${mrfCount} MRF(s), and ${userCount} user(s) linked to it.`,
        counts: { branchCount, mrfCount, userCount },
      },
      { status: 409 }
    );
  }

  await prisma.country.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
