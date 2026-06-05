import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryId = searchParams.get("countryId");

  const divisions = await prisma.division.findMany({
    where: countryId ? { countryId } : {},
    include: { states: { include: { branches: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(divisions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const division = await prisma.division.create({ data: body });
  return NextResponse.json(division, { status: 201 });
}
