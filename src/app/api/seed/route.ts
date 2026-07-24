import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import bcrypt from "bcryptjs";

export async function POST() {
  try {
    const existingAdmin = await db("RECRUIT_T_User").where({ role: "ADMIN" }).first();
    if (existingAdmin) {
      return NextResponse.json({ message: "Database already seeded." }, { status: 200 });
    }

    const hashedPassword = await bcrypt.hash("admin123", 10);
    const now = new Date();

    await db.transaction(async (trx) => {
      // Create Admin
      const adminId = newId();
      await trx("RECRUIT_T_User").insert({
        id: adminId, name: "System Admin", userName: "admin", email: "admin@recruitpro.com",
        password: hashedPassword, role: "ADMIN", createdAt: now, updatedAt: now,
      });

      // Create HR
      await trx("RECRUIT_T_User").insert({
        id: newId(), name: "HR Manager", userName: "hr", email: "hr@recruitpro.com",
        password: await bcrypt.hash("hr123", 10), role: "HR", createdAt: now, updatedAt: now,
      });

      // Create India country
      const indiaId = newId();
      await trx("RECRUIT_T_Country").insert({
        id: indiaId, name: "India", code: "IN", locationType: "INDIA", createdAt: now, updatedAt: now,
      });

      // Create Overseas countries
      const overseasCountries = [
        { name: "Australia", code: "AU" }, { name: "UAE", code: "AE" },
        { name: "Oman", code: "OM" }, { name: "South Africa", code: "ZA" },
        { name: "Japan", code: "JP" }, { name: "Indonesia", code: "ID" },
      ];
      for (const c of overseasCountries) {
        await trx("RECRUIT_T_Country").insert({
          id: newId(), ...c, locationType: "OVERSEAS", createdAt: now, updatedAt: now,
        });
      }

      // Create Corporate country
      const corporateId = newId();
      await trx("RECRUIT_T_Country").insert({
        id: corporateId, name: "Corporate", code: "CORP", locationType: "CORPORATE", createdAt: now, updatedAt: now,
      });

      // India divisions
      const swDivisionId = newId();
      await trx("RECRUIT_T_Division").insert({
        id: swDivisionId, name: "South West Division", countryId: indiaId, createdAt: now, updatedAt: now,
      });
      const ecDivisionId = newId();
      await trx("RECRUIT_T_Division").insert({
        id: ecDivisionId, name: "East Central Division", countryId: indiaId, createdAt: now, updatedAt: now,
      });

      // SW States & Branches
      const gujaratId = newId();
      await trx("RECRUIT_T_State").insert({
        id: gujaratId, name: "Gujarat", divisionId: swDivisionId, createdAt: now, updatedAt: now,
      });
      const maharashtraId = newId();
      await trx("RECRUIT_T_State").insert({
        id: maharashtraId, name: "Maharashtra", divisionId: swDivisionId, createdAt: now, updatedAt: now,
      });

      const gandhidhamBranchId = newId();
      await trx("RECRUIT_T_Branch").insert({
        id: gandhidhamBranchId, name: "Gandhidham", code: "GDM", countryId: indiaId, stateId: gujaratId,
        createdAt: now, updatedAt: now,
      });
      await trx("RECRUIT_T_Branch").insert({
        id: newId(), name: "Mumbai", code: "MUM", countryId: indiaId, stateId: maharashtraId,
        createdAt: now, updatedAt: now,
      });

      // EC States
      const wbId = newId();
      await trx("RECRUIT_T_State").insert({
        id: wbId, name: "West Bengal", divisionId: ecDivisionId, createdAt: now, updatedAt: now,
      });
      await trx("RECRUIT_T_Branch").insert({
        id: newId(), name: "Kolkata", code: "KOL", countryId: indiaId, stateId: wbId,
        createdAt: now, updatedAt: now,
      });

      // Corporate branches
      await trx("RECRUIT_T_Branch").insert({
        id: newId(), name: "Kolkata HO", code: "KOL-HO", countryId: corporateId, createdAt: now, updatedAt: now,
      });
      await trx("RECRUIT_T_Branch").insert({
        id: newId(), name: "Delhi HO", code: "DEL-HO", countryId: corporateId, createdAt: now, updatedAt: now,
      });

      // Departments
      const departments = ["Operations", "Finance", "HR", "Engineering", "IT", "Procurement", "Safety", "Marketing"];
      const createdDepts: Record<string, string> = {};
      for (const name of departments) {
        const deptId = newId();
        await trx("RECRUIT_T_Department").insert({ id: deptId, name, createdAt: now, updatedAt: now });
        createdDepts[name] = deptId;
      }

      // Designations
      await trx("RECRUIT_T_Designation").insert([
        { id: newId(), title: "Manager", departmentId: createdDepts["Operations"], requiresPsychometric: 1, createdAt: now, updatedAt: now },
        { id: newId(), title: "Senior Engineer", departmentId: createdDepts["Engineering"], requiresPsychometric: 1, createdAt: now, updatedAt: now },
        { id: newId(), title: "Engineer", departmentId: createdDepts["Engineering"], requiresPsychometric: 0, createdAt: now, updatedAt: now },
        { id: newId(), title: "Analyst", departmentId: createdDepts["Finance"], requiresPsychometric: 0, createdAt: now, updatedAt: now },
        { id: newId(), title: "HR Executive", departmentId: createdDepts["HR"], requiresPsychometric: 0, createdAt: now, updatedAt: now },
        { id: newId(), title: "IT Specialist", departmentId: createdDepts["IT"], requiresPsychometric: 0, createdAt: now, updatedAt: now },
        { id: newId(), title: "Procurement Officer", departmentId: createdDepts["Procurement"], requiresPsychometric: 0, createdAt: now, updatedAt: now },
        { id: newId(), title: "Safety Officer", departmentId: createdDepts["Safety"], requiresPsychometric: 1, createdAt: now, updatedAt: now },
      ]);

      // Branch Manager
      const bmId = newId();
      await trx("RECRUIT_T_User").insert({
        id: bmId, name: "Rajesh Kumar", userName: "bm", email: "bm@recruitpro.com",
        password: await bcrypt.hash("bm123", 10), role: "BRANCH_MANAGER",
        branchId: gandhidhamBranchId, countryId: indiaId, createdAt: now, updatedAt: now,
      });

      // Divisional Manager
      await trx("RECRUIT_T_User").insert({
        id: newId(), name: "Priya Sharma", userName: "dm", email: "dm@recruitpro.com",
        password: await bcrypt.hash("dm123", 10), role: "DIVISIONAL_MANAGER",
        countryId: indiaId, createdAt: now, updatedAt: now,
      });

      // Candidate
      const candidateUserId = newId();
      await trx("RECRUIT_T_User").insert({
        id: candidateUserId, name: "Amit Verma", userName: "candidate", email: "candidate@recruitpro.com",
        password: await bcrypt.hash("candidate123", 10), role: "CANDIDATE", createdAt: now, updatedAt: now,
      });

      // Sample MRF
      const mrfId = newId();
      await trx("RECRUIT_T_MRF").insert({
        id: mrfId,
        mrfNumber: "MRF-2026-0001",
        title: "Engineer - Gandhidham Operations",
        countryId: indiaId,
        divisionId: swDivisionId,
        branchId: gandhidhamBranchId,
        departmentId: createdDepts["Operations"],
        vacancyCount: 2,
        justification: "Expansion of operations at Gandhidham branch requires 2 additional engineers.",
        status: "PENDING_DIVISIONAL",
        createdById: bmId,
        createdAt: now,
        updatedAt: now,
      });

      // Sample Candidate
      const candidateId = newId();
      await trx("RECRUIT_T_Candidate").insert({
        id: candidateId,
        userId: candidateUserId,
        mrfId,
        firstName: "Amit",
        lastName: "Verma",
        email: "candidate@recruitpro.com",
        phone: "+91-9876543210",
        currentStage: "SHORTLISTED",
        aiScore: 82.5,
        createdAt: now,
        updatedAt: now,
      });

      await trx("RECRUIT_T_CandidateStageHistory").insert([
        { id: newId(), candidateId, fromStage: null, toStage: "APPLIED", notes: "Application received", changedAt: now },
        { id: newId(), candidateId, fromStage: "APPLIED", toStage: "AI_SCREENING", notes: "Moved to AI screening", changedAt: now },
        { id: newId(), candidateId, fromStage: "AI_SCREENING", toStage: "SHORTLISTED", notes: "AI score: 82.5 - Shortlisted", changedAt: now },
      ]);
    });

    return NextResponse.json({
      message: "Database seeded successfully!",
      credentials: {
        admin: "admin@recruitpro.com / admin123",
        hr: "hr@recruitpro.com / hr123",
        branchManager: "bm@recruitpro.com / bm123",
        divisionalManager: "dm@recruitpro.com / dm123",
        candidate: "candidate@recruitpro.com / candidate123",
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Seed failed", details: String(error) }, { status: 500 });
  }
}
