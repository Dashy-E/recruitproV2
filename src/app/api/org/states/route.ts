import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const divisionId = searchParams.get("divisionId");

  const states = await db("RECRUIT_T_State")
    .modify((qb) => {
      if (divisionId) qb.where({ divisionId });
    })
    .orderBy("name", "asc");

  const stateIds = states.map((s: any) => s.id);
  const branches = stateIds.length
    ? await db("RECRUIT_T_Branch").whereIn("stateId", stateIds)
    : [];

  const result = states.map((state: any) => ({
    ...state,
    branches: branches.filter((b: any) => b.stateId === state.id),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_ORG")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const now = new Date();
  const [state] = await db("RECRUIT_T_State")
    .insert({ id: newId(), ...body, createdAt: now, updatedAt: now })
    .returning("*");
  return NextResponse.json(state, { status: 201 });
}
