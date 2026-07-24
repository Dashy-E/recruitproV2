import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryId = searchParams.get("countryId");
  const stateId = searchParams.get("stateId");
  const divisionId = searchParams.get("divisionId");

  try {
    if (divisionId) {
      // Fetch branches that belong to this division's states OR directly to this division
      const states = await db("RECRUIT_T_State").where({ divisionId }).select("id");
      const stateIds = states.map((s: any) => s.id);

      const branches = await db("RECRUIT_T_Branch")
        .where({ isActive: 1 })
        .where((qb) => {
          if (stateIds.length > 0) qb.whereIn("stateId", stateIds).orWhere({ divisionId });
          else qb.where({ divisionId });
        })
        .orderBy("name", "asc");
      return NextResponse.json(branches);
    }

    if (stateId) {
      const branches = await db("RECRUIT_T_Branch")
        .where({ isActive: 1, stateId })
        .orderBy("name", "asc");
      return NextResponse.json(branches);
    }

    if (countryId) {
      const branches = await db("RECRUIT_T_Branch")
        .where({ isActive: 1, countryId })
        .orderBy("name", "asc");
      return NextResponse.json(branches);
    }

    // No filter — return all active branches
    const branches = await db("RECRUIT_T_Branch").where({ isActive: 1 }).orderBy("name", "asc");
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

  if (!hasPermission(session, "MANAGE_ORG")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, code, countryId, stateId } = body;

  const now = new Date();
  const [branch] = await db("RECRUIT_T_Branch")
    .insert({
      id: newId(),
      name,
      code,
      countryId,
      stateId: stateId || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning("*");

  return NextResponse.json(branch, { status: 201 });
}
