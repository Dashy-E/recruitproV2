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

      // Org structure: a generic self-referencing tree (RECRUIT_T_OrgUnit)
      // replaces the old fixed Country/Division/State/Branch chain, so an
      // admin can add/move/rename nodes at runtime without a code change.
      const orgIds: Record<string, string> = {};
      async function orgUnit(name: string, parentPath: string | null, sortOrder = 0) {
        const id = newId();
        await trx("RECRUIT_T_OrgUnit").insert({
          id, name, parentId: parentPath ? orgIds[parentPath] : null, sortOrder,
          createdAt: now, updatedAt: now,
        });
        const path = parentPath ? `${parentPath}>${name}` : name;
        orgIds[path] = id;
        return id;
      }

      await orgUnit("Corporate", null, 1);
      await orgUnit("HO", "Corporate", 1);
      await orgUnit("CL", "Corporate", 2);
      await orgUnit("UL", "Corporate", 3);

      await orgUnit("India", null, 2);
      await orgUnit("SW", "India", 1);
      for (const [i, name] of ["Gandhidham", "Udaypur", "Goa", "Mumbai", "Hosapete", "Chennai"].entries()) {
        await orgUnit(name, "India>SW", i + 1);
      }
      await orgUnit("EC", "India", 2);
      for (const [i, name] of ["Katni", "West Bengal", "BBSR", "Barbil", "Vizag", "West Odisha (Raipur)", "Gawahati"].entries()) {
        await orgUnit(name, "India>EC", i + 1);
      }

      await orgUnit("PSPL", null, 3);
      await orgUnit("Gemini", null, 4);

      await orgUnit("Overseas", null, 5);
      for (const [i, name] of ["China", "Bangladesh", "Indonesia", "Singapore", "Vietnam", "UAE", "Dubai"].entries()) {
        await orgUnit(name, "Overseas", i + 1);
      }
      await orgUnit("West Africa", "Overseas", 8);
      for (const [i, name] of ["Morocco", "Gabon", "Oman"].entries()) await orgUnit(name, "Overseas>West Africa", i + 1);
      await orgUnit("South Africa", "Overseas", 9);
      for (const [i, name] of ["Richard Bay", "Johannesburg", "Northern Cape"].entries()) await orgUnit(name, "Overseas>South Africa", i + 1);
      await orgUnit("DRC", "Overseas", 10);
      await orgUnit("Rosa", "Overseas", 11);
      for (const [i, name] of ["Tanzania", "Mozambique", "Zambia"].entries()) await orgUnit(name, "Overseas>Rosa", i + 1);
      await orgUnit("Europe", "Overseas", 12);
      for (const [i, name] of ["Netherlands", "Turkey"].entries()) await orgUnit(name, "Overseas>Europe", i + 1);
      await orgUnit("Brazil", "Overseas", 13);
      for (const [i, name] of ["Bar", "Itjoy"].entries()) await orgUnit(name, "Overseas>Brazil", i + 1);
      await orgUnit("Chile", "Overseas", 14);
      await orgUnit("Australia", "Overseas", 15);
      await orgUnit("Gladstone", "Overseas", 16);

      const gandhidhamOrgUnitId = orgIds["India>SW>Gandhidham"];
      const indiaOrgUnitId = orgIds["India"];

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
        createdAt: now, updatedAt: now,
      });
      await trx("RECRUIT_T_UserOrgUnit").insert({ id: newId(), userId: bmId, orgUnitId: gandhidhamOrgUnitId, createdAt: now });

      // Divisional Manager
      const dmId = newId();
      await trx("RECRUIT_T_User").insert({
        id: dmId, name: "Priya Sharma", userName: "dm", email: "dm@recruitpro.com",
        password: await bcrypt.hash("dm123", 10), role: "DIVISIONAL_MANAGER",
        createdAt: now, updatedAt: now,
      });
      await trx("RECRUIT_T_UserOrgUnit").insert({ id: newId(), userId: dmId, orgUnitId: indiaOrgUnitId, createdAt: now });

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
        orgUnitId: gandhidhamOrgUnitId,
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
