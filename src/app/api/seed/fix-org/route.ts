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

  // 1. Fix Bhubaneswar branch code to BBSR
  const bbsr = await db("RECRUIT_T_Branch").where({ name: "Bhubaneswar" }).first();
  if (bbsr) {
    if (bbsr.code !== "BBSR") {
      await db("RECRUIT_T_Branch").where({ id: bbsr.id }).update({ code: "BBSR", updatedAt: now });
      log.push(`Updated Bhubaneswar branch code from "${bbsr.code}" to "BBSR"`);
    } else {
      log.push(`Bhubaneswar branch code already "BBSR" — skipped`);
    }
  } else {
    log.push("Branch 'Bhubaneswar' not found — skipped");
  }

  // 2. Ensure Raipur Lab in East Central division under Chhattisgarh state
  const eastCentral = await db("RECRUIT_T_Division")
    .whereRaw('UPPER("name") LIKE UPPER(?)', [`%East Central%`])
    .first();
  if (eastCentral) {
    // Ensure Chhattisgarh state
    let chhattisgarh = await db("RECRUIT_T_State")
      .where({ divisionId: eastCentral.id, name: "Chhattisgarh" })
      .first();
    if (!chhattisgarh) {
      const id = newId();
      await db("RECRUIT_T_State").insert({ id, name: "Chhattisgarh", divisionId: eastCentral.id, createdAt: now, updatedAt: now });
      chhattisgarh = { id, name: "Chhattisgarh", divisionId: eastCentral.id };
      log.push("Created state 'Chhattisgarh' in East Central division");
    } else {
      log.push("State 'Chhattisgarh' already exists in East Central division");
    }

    // Ensure Raipur Lab branch
    const raipur = await db("RECRUIT_T_Branch").where({ code: "RPR-LAB" }).first();
    if (!raipur) {
      await db("RECRUIT_T_Branch").insert({
        id: newId(), name: "Raipur Lab", code: "RPR-LAB",
        countryId: eastCentral.countryId, stateId: chhattisgarh.id, createdAt: now, updatedAt: now,
      });
      log.push("Created branch 'Raipur Lab' (RPR-LAB) in Chhattisgarh");
    } else {
      log.push("Branch 'Raipur Lab' (RPR-LAB) already exists — skipped");
    }
  } else {
    log.push("Division 'East Central' not found — skipped Raipur Lab creation");
  }

  // 3. Ensure Central Lab and Udayayan Lab on Corporate country
  const corporate = await db("RECRUIT_T_Country").where({ locationType: "CORPORATE" }).first();
  if (corporate) {
    const labs = [
      { name: "Central Lab", code: "CTRL-LAB" },
      { name: "Udayayan Lab", code: "UDYN-LAB" },
    ];
    for (const lab of labs) {
      const existing = await db("RECRUIT_T_Branch").where({ code: lab.code }).first();
      if (!existing) {
        await db("RECRUIT_T_Branch").insert({
          id: newId(), name: lab.name, code: lab.code, countryId: corporate.id, createdAt: now, updatedAt: now,
        });
        log.push(`Created branch '${lab.name}' (${lab.code}) on Corporate`);
      } else {
        log.push(`Branch '${lab.name}' (${lab.code}) already exists — skipped`);
      }
    }
  } else {
    log.push("Corporate country not found — skipped lab creation");
  }

  // 4. Create demo Employee user if missing
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
