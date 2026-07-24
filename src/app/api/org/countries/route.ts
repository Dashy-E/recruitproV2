import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  try {
    const countries = await db("RECRUIT_T_Country").orderBy("name", "asc");
    const divisions = await db("RECRUIT_T_Division");
    const states = await db("RECRUIT_T_State");
    const branches = await db("RECRUIT_T_Branch").where({ isActive: 1 });

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

  if (!hasPermission(session, "MANAGE_ORG")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, code, locationType } = body;

  const now = new Date();
  const [country] = await db("RECRUIT_T_Country")
    .insert({
      id: newId(),
      name,
      code,
      locationType: locationType || "OVERSEAS",
      createdAt: now,
      updatedAt: now,
    })
    .returning("*");

  return NextResponse.json(country, { status: 201 });
}
