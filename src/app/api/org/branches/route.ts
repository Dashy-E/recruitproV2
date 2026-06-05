import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryId = searchParams.get("countryId");
  const stateId = searchParams.get("stateId");

  const branches = await prisma.branch.findMany({
    where: {
      ...(countryId ? { countryId } : {}),
      ...(stateId ? { stateId } : {}),
      isActive: true,
    },
    include: { state: true, country: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(branches);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, code, countryId, stateId } = body;

  const branch = await prisma.branch.create({
    data: { name, code, countryId, stateId: stateId || null },
  });

  return NextResponse.json(branch, { status: 201 });
}
