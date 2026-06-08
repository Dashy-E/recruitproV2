import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const log: string[] = [];

  // 1. Fix Bhubaneswar branch code to BBSR
  const bbsr = await prisma.branch.findFirst({ where: { name: "Bhubaneswar" } });
  if (bbsr) {
    if (bbsr.code !== "BBSR") {
      await prisma.branch.update({ where: { id: bbsr.id }, data: { code: "BBSR" } });
      log.push(`Updated Bhubaneswar branch code from "${bbsr.code}" to "BBSR"`);
    } else {
      log.push(`Bhubaneswar branch code already "BBSR" — skipped`);
    }
  } else {
    log.push("Branch 'Bhubaneswar' not found — skipped");
  }

  // 2. Ensure Raipur Lab in East Central division under Chhattisgarh state
  const eastCentral = await prisma.division.findFirst({ where: { name: { contains: "East Central" } } });
  if (eastCentral) {
    // Ensure Chhattisgarh state
    let chhattisgarh = await prisma.state.findFirst({
      where: { divisionId: eastCentral.id, name: "Chhattisgarh" },
    });
    if (!chhattisgarh) {
      chhattisgarh = await prisma.state.create({
        data: { name: "Chhattisgarh", divisionId: eastCentral.id },
      });
      log.push("Created state 'Chhattisgarh' in East Central division");
    } else {
      log.push("State 'Chhattisgarh' already exists in East Central division");
    }

    // Ensure Raipur Lab branch
    const raipur = await prisma.branch.findFirst({ where: { code: "RPR-LAB" } });
    if (!raipur) {
      await prisma.branch.create({
        data: {
          name: "Raipur Lab",
          code: "RPR-LAB",
          countryId: eastCentral.countryId,
          stateId: chhattisgarh.id,
        },
      });
      log.push("Created branch 'Raipur Lab' (RPR-LAB) in Chhattisgarh");
    } else {
      log.push("Branch 'Raipur Lab' (RPR-LAB) already exists — skipped");
    }
  } else {
    log.push("Division 'East Central' not found — skipped Raipur Lab creation");
  }

  // 3. Ensure Central Lab and Udayayan Lab on Corporate country
  const corporate = await prisma.country.findFirst({ where: { locationType: "CORPORATE" } });
  if (corporate) {
    const labs = [
      { name: "Central Lab", code: "CTRL-LAB" },
      { name: "Udayayan Lab", code: "UDYN-LAB" },
    ];
    for (const lab of labs) {
      const existing = await prisma.branch.findFirst({ where: { code: lab.code } });
      if (!existing) {
        await prisma.branch.create({
          data: { name: lab.name, code: lab.code, countryId: corporate.id },
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
  const existingEmp = await prisma.user.findUnique({ where: { email: empEmail } });
  if (!existingEmp) {
    const empUser = await prisma.user.create({
      data: {
        name: "Demo Employee",
        email: empEmail,
        password: await bcrypt.hash("emp123", 10),
        role: "EMPLOYEE",
      },
    });
    // Create a linked candidate record so the profile exists
    await prisma.candidate.create({
      data: {
        userId: empUser.id,
        firstName: "Demo",
        lastName: "Employee",
        email: empEmail,
        currentStage: "JOINED",
        candidateStatus: "ACTIVE",
      },
    });
    log.push("Created demo employee user (employee@recruitpro.com / emp123)");
  } else {
    log.push("Demo employee user already exists — skipped");
  }

  return NextResponse.json({ success: true, log });
}
