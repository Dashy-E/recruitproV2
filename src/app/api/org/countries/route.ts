import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Use raw SQL so this works regardless of Prisma client cache state
    const countries = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM Country ORDER BY name ASC`);
    const divisions = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM Division`);
    const states = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM State`);
    const branches = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM Branch WHERE isActive = 1`);

    const result = countries.map((country: any) => {
      const countryDivisions = divisions.filter((d: any) => d.countryId === country.id);

      return {
        ...country,
        // Top-level branches: no state, no division
        branches: branches.filter((b: any) => b.countryId === country.id && !b.stateId && !b.divisionId),
        divisions: countryDivisions.map((div: any) => {
          const divStates = states.filter((s: any) => s.divisionId === div.id);
          return {
            ...div,
            // Direct division branches (Corporate offices)
            branches: branches.filter((b: any) => b.divisionId === div.id && !b.stateId),
            states: divStates.map((state: any) => ({
              ...state,
              branches: branches.filter((b: any) => b.stateId === state.id),
            })),
          };
        }),
      };
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET /api/org/countries error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
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
