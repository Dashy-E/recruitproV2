import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryId = searchParams.get("countryId");

  const divisions = await db("RECRUIT_T_Division")
    .modify((qb) => {
      if (countryId) qb.where({ countryId });
    })
    .orderBy("name", "asc");

  const divisionIds = divisions.map((d: any) => d.id);
  const states = divisionIds.length
    ? await db("RECRUIT_T_State").whereIn("divisionId", divisionIds).orderBy("name", "asc")
    : [];
  const stateIds = states.map((s: any) => s.id);
  const branches = stateIds.length
    ? await db("RECRUIT_T_Branch").whereIn("stateId", stateIds)
    : [];

  const result = divisions.map((div: any) => ({
    ...div,
    states: states
      .filter((s: any) => s.divisionId === div.id)
      .map((state: any) => ({
        ...state,
        branches: branches.filter((b: any) => b.stateId === state.id),
      })),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_ORG")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const now = new Date();
  const [division] = await db("RECRUIT_T_Division")
    .insert({ id: newId(), ...body, createdAt: now, updatedAt: now })
    .returning("*");
  return NextResponse.json(division, { status: 201 });
}
