import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const countries = await prisma.country.findMany({
    include: {
      divisions: { include: { states: { include: { branches: true } } } },
      branches: { where: { stateId: null } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(countries);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, code, locationType } = body;

  const country = await prisma.country.create({
    data: { name, code, locationType: locationType || "OVERSEAS" },
  });

  return NextResponse.json(country, { status: 201 });
}
