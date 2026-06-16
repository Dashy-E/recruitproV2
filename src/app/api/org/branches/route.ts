import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryId = searchParams.get("countryId");
  const stateId = searchParams.get("stateId");
  const divisionId = searchParams.get("divisionId");

  try {
    if (divisionId) {
      // Fetch branches that belong to this division's states OR directly to this division
      const states = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM State WHERE divisionId = ?`, divisionId
      );
      const stateIds = states.map((s: any) => s.id);

      let branches: any[];
      if (stateIds.length > 0) {
        const placeholders = stateIds.map(() => "?").join(", ");
        branches = await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM Branch WHERE isActive = 1 AND (stateId IN (${placeholders}) OR divisionId = ?) ORDER BY name ASC`,
          ...stateIds, divisionId
        );
      } else {
        branches = await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM Branch WHERE isActive = 1 AND divisionId = ? ORDER BY name ASC`,
          divisionId
        );
      }
      return NextResponse.json(branches);
    }

    if (stateId) {
      const branches = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM Branch WHERE isActive = 1 AND stateId = ? ORDER BY name ASC`,
        stateId
      );
      return NextResponse.json(branches);
    }

    if (countryId) {
      const branches = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM Branch WHERE isActive = 1 AND countryId = ? ORDER BY name ASC`,
        countryId
      );
      return NextResponse.json(branches);
    }

    // No filter — return all active branches
    const branches = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM Branch WHERE isActive = 1 ORDER BY name ASC`
    );
    return NextResponse.json(branches);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET /api/org/branches error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
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
