import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const divisionId = searchParams.get("divisionId");

  const states = await prisma.state.findMany({
    where: divisionId ? { divisionId } : {},
    include: { branches: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(states);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const state = await prisma.state.create({ data: body });
  return NextResponse.json(state, { status: 201 });
}
