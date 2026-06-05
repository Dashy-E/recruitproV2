import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST() {
  try {
    const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (existingAdmin) {
      return NextResponse.json({ message: "Database already seeded." }, { status: 200 });
    }

    const hashedPassword = await bcrypt.hash("admin123", 10);

    // Create Admin
    const admin = await prisma.user.create({
      data: {
        name: "System Admin",
        email: "admin@recruitpro.com",
        password: hashedPassword,
        role: "ADMIN",
      },
    });

    // Create HR
    await prisma.user.create({
      data: {
        name: "HR Manager",
        email: "hr@recruitpro.com",
        password: await bcrypt.hash("hr123", 10),
        role: "HR",
      },
    });

    // Create India country
    const india = await prisma.country.create({
      data: { name: "India", code: "IN", locationType: "INDIA" },
    });

    // Create Overseas countries
    const overseasCountries = [
      { name: "Australia", code: "AU" }, { name: "UAE", code: "AE" },
      { name: "Oman", code: "OM" }, { name: "South Africa", code: "ZA" },
      { name: "Japan", code: "JP" }, { name: "Indonesia", code: "ID" },
    ];
    for (const c of overseasCountries) {
      await prisma.country.create({ data: { ...c, locationType: "OVERSEAS" } });
    }

    // Create Corporate country
    const corporate = await prisma.country.create({
      data: { name: "Corporate", code: "CORP", locationType: "CORPORATE" },
    });

    // India divisions
    const swDivision = await prisma.division.create({ data: { name: "South West Division", countryId: india.id } });
    const ecDivision = await prisma.division.create({ data: { name: "East Central Division", countryId: india.id } });

    // SW States & Branches
    const gujarat = await prisma.state.create({ data: { name: "Gujarat", divisionId: swDivision.id } });
    const maharashtra = await prisma.state.create({ data: { name: "Maharashtra", divisionId: swDivision.id } });

    const gandhidhamBranch = await prisma.branch.create({ data: { name: "Gandhidham", code: "GDM", countryId: india.id, stateId: gujarat.id } });
    await prisma.branch.create({ data: { name: "Mumbai", code: "MUM", countryId: india.id, stateId: maharashtra.id } });

    // EC States
    const wb = await prisma.state.create({ data: { name: "West Bengal", divisionId: ecDivision.id } });
    const kolkataBranch = await prisma.branch.create({ data: { name: "Kolkata", code: "KOL", countryId: india.id, stateId: wb.id } });

    // Corporate branches
    await prisma.branch.create({ data: { name: "Kolkata HO", code: "KOL-HO", countryId: corporate.id } });
    await prisma.branch.create({ data: { name: "Delhi HO", code: "DEL-HO", countryId: corporate.id } });

    // Departments
    const departments = ["Operations", "Finance", "HR", "Engineering", "IT", "Procurement", "Safety", "Marketing"];
    const createdDepts: Record<string, string> = {};
    for (const name of departments) {
      const dept = await prisma.department.create({ data: { name } });
      createdDepts[name] = dept.id;
    }

    // Designations
    await prisma.designation.createMany({
      data: [
        { title: "Manager", departmentId: createdDepts["Operations"], requiresPsychometric: true },
        { title: "Senior Engineer", departmentId: createdDepts["Engineering"], requiresPsychometric: true },
        { title: "Engineer", departmentId: createdDepts["Engineering"], requiresPsychometric: false },
        { title: "Analyst", departmentId: createdDepts["Finance"], requiresPsychometric: false },
        { title: "HR Executive", departmentId: createdDepts["HR"], requiresPsychometric: false },
        { title: "IT Specialist", departmentId: createdDepts["IT"], requiresPsychometric: false },
        { title: "Procurement Officer", departmentId: createdDepts["Procurement"], requiresPsychometric: false },
        { title: "Safety Officer", departmentId: createdDepts["Safety"], requiresPsychometric: true },
      ],
    });

    // Branch Manager
    const bm = await prisma.user.create({
      data: {
        name: "Rajesh Kumar",
        email: "bm@recruitpro.com",
        password: await bcrypt.hash("bm123", 10),
        role: "BRANCH_MANAGER",
        branchId: gandhidhamBranch.id,
        countryId: india.id,
      },
    });

    // Divisional Manager
    await prisma.user.create({
      data: {
        name: "Priya Sharma",
        email: "dm@recruitpro.com",
        password: await bcrypt.hash("dm123", 10),
        role: "DIVISIONAL_MANAGER",
        countryId: india.id,
      },
    });

    // Candidate
    const candidateUser = await prisma.user.create({
      data: {
        name: "Amit Verma",
        email: "candidate@recruitpro.com",
        password: await bcrypt.hash("candidate123", 10),
        role: "CANDIDATE",
      },
    });

    // Sample MRF
    const mrf = await prisma.mRF.create({
      data: {
        mrfNumber: "MRF-2026-0001",
        title: "Engineer - Gandhidham Operations",
        countryId: india.id,
        divisionId: swDivision.id,
        branchId: gandhidhamBranch.id,
        departmentId: createdDepts["Operations"],
        vacancyCount: 2,
        justification: "Expansion of operations at Gandhidham branch requires 2 additional engineers.",
        status: "PENDING_DIVISIONAL",
        createdById: bm.id,
      },
    });

    // Sample Candidate
    await prisma.candidate.create({
      data: {
        userId: candidateUser.id,
        mrfId: mrf.id,
        firstName: "Amit",
        lastName: "Verma",
        email: "candidate@recruitpro.com",
        phone: "+91-9876543210",
        currentStage: "SHORTLISTED",
        aiScore: 82.5,
        stageHistory: {
          create: [
            { fromStage: null, toStage: "APPLIED", notes: "Application received" },
            { fromStage: "APPLIED", toStage: "AI_SCREENING", notes: "Moved to AI screening" },
            { fromStage: "AI_SCREENING", toStage: "SHORTLISTED", notes: "AI score: 82.5 - Shortlisted" },
          ],
        },
      },
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
