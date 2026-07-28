import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";
import { getAllOrgUnits, getAncestorPath } from "@/lib/org-access";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_CANDIDATES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const mrfId = searchParams.get("mrfId");

  const candidates: any[] = await db("RECRUIT_T_Candidate")
    .modify((qb) => {
      if (stage) qb.where({ currentStage: stage });
      if (mrfId) qb.where({ mrfId });
    })
    .orderBy("createdAt", "desc");

  if (!candidates.length) return NextResponse.json([]);

  const userIds = candidates.map((c: any) => c.userId);
  const mrfIds = [...new Set(candidates.map((c: any) => c.mrfId).filter(Boolean))];
  const candidateIds = candidates.map((c: any) => c.id);

  const usersQuery = db("RECRUIT_T_User").whereIn("id", userIds).select("id", "name", "email");
  const mrfsQuery = db("RECRUIT_T_MRF").whereIn("id", mrfIds);
  const stageHistoryQuery = db("RECRUIT_T_CandidateStageHistory").whereIn("candidateId", candidateIds).orderBy("changedAt", "desc");
  const employeesQuery = db("RECRUIT_T_Employee").whereIn("candidateId", candidateIds).select("id", "candidateId");
  const [users, mrfs, stageHistory, employees] = await Promise.all([usersQuery, mrfsQuery, stageHistoryQuery, employeesQuery]);

  const departmentIds = [...new Set(mrfs.map((m: any) => m.departmentId).filter(Boolean))];
  const [departments, orgUnits] = await Promise.all([
    db("RECRUIT_T_Department").whereIn("id", departmentIds),
    getAllOrgUnits(),
  ]);

  const mrfsWithRelations = mrfs.map((m: any) => {
    const path = getAncestorPath(m.orgUnitId, orgUnits);
    return {
      ...m,
      department: departments.find((d: any) => d.id === m.departmentId) || null,
      orgUnit: path.length ? { id: m.orgUnitId, name: path.at(-1)!.name, path: path.map((p) => p.name).join(" / ") } : null,
    };
  });

  const result = candidates.map((c: any) => ({
    ...c,
    user: (() => {
      const u = users.find((x: any) => x.id === c.userId);
      return u ? { name: u.name, email: u.email } : null;
    })(),
    mrf: c.mrfId ? mrfsWithRelations.find((m: any) => m.id === c.mrfId) || null : null,
    stageHistory: stageHistory.filter((s: any) => s.candidateId === c.id),
    employee: (() => {
      const e = employees.find((x: any) => x.candidateId === c.id);
      return e ? { id: e.id } : null;
    })(),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_CANDIDATES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { firstName, lastName, email, phone, mrfId } = body;

  // Create user account for candidate
  const existingUser = await db("RECRUIT_T_User").where({ email }).first();
  let userId = existingUser?.id;

  let tempPassword: string | undefined;
  if (!existingUser) {
    tempPassword = Math.random().toString(36).slice(-8);
    userId = newId();
    const now = new Date();

    // Auto-derive a unique username from the email local-part since this
    // HR/Admin-driven flow doesn't collect one directly.
    const base = email.split("@")[0];
    let userName = base;
    let suffix = 1;
    while (await db("RECRUIT_T_User").where({ userName }).first()) {
      userName = `${base}${++suffix}`;
    }

    await db("RECRUIT_T_User").insert({
      id: userId,
      name: `${firstName} ${lastName}`,
      userName,
      email,
      password: await bcrypt.hash(tempPassword, 10),
      role: "CANDIDATE",
      createdAt: now,
      updatedAt: now,
    });
  }

  const candidateId = newId();
  const now = new Date();

  await db.transaction(async (trx) => {
    await trx("RECRUIT_T_Candidate").insert({
      id: candidateId,
      userId: userId!,
      mrfId: mrfId || null,
      firstName,
      lastName,
      email,
      phone,
      currentStage: "APPLIED",
      createdAt: now,
      updatedAt: now,
    });

    await trx("RECRUIT_T_CandidateStageHistory").insert({
      id: newId(),
      candidateId,
      toStage: "APPLIED",
      notes: "Candidate added to system",
      changedAt: now,
    });
  });

  const [candidate, user, mrf] = await Promise.all([
    db("RECRUIT_T_Candidate").where({ id: candidateId }).first(),
    db("RECRUIT_T_User").where({ id: userId }).select("name").first(),
    mrfId ? db("RECRUIT_T_MRF").where({ id: mrfId }).first() : null,
  ]);

  return NextResponse.json(
    { ...candidate, user: user ? { name: user.name } : null, mrf: mrf || null, tempPassword },
    { status: 201 }
  );
}
