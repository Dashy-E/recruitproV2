import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import bcrypt from "bcryptjs";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const log: string[] = [];
  const now = new Date();

  // Create demo Employee user if missing
  const empEmail = "employee@recruitpro.com";
  const existingEmp = await db("RECRUIT_T_User").where({ email: empEmail }).first();
  if (!existingEmp) {
    const empUserId = newId();
    await db.transaction(async (trx) => {
      await trx("RECRUIT_T_User").insert({
        id: empUserId, name: "Demo Employee", userName: "employee", email: empEmail,
        password: await bcrypt.hash("emp123", 10), role: "EMPLOYEE", createdAt: now, updatedAt: now,
      });
      // Create a linked candidate record so the profile exists
      await trx("RECRUIT_T_Candidate").insert({
        id: newId(), userId: empUserId, firstName: "Demo", lastName: "Employee",
        email: empEmail, currentStage: "JOINED", candidateStatus: "ACTIVE",
        createdAt: now, updatedAt: now,
      });
    });
    log.push("Created demo employee user (employee@recruitpro.com / emp123)");
  } else {
    log.push("Demo employee user already exists — skipped");
  }

  return NextResponse.json({ success: true, log });
}
