import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STAGES = [
  { key: "APPLIED", label: "Applications", stepOrder: 1 },
  { key: "INTERVIEW_1", label: "Interview – Round 1", stepOrder: 2 },
  { key: "INTERVIEW_2", label: "Interview – Round 2", stepOrder: 3 },
  { key: "INTERVIEW_3", label: "Interview – Round 3", stepOrder: 4 },
  { key: "PSYCHOMETRIC_TEST", label: "Psychometric Test", stepOrder: 5 },
  { key: "SHORTLISTED", label: "Shortlisted / Selected", stepOrder: 6 },
  { key: "SALARY_NEGOTIATION", label: "Salary Negotiation & Docs", stepOrder: 7 },
  { key: "CTC_OFFERED", label: "CTC Offered", stepOrder: 8 },
  { key: "OFFER_LETTER", label: "Offer Letter Issued", stepOrder: 9 },
  { key: "JOINED", label: "Joined", stepOrder: 10 },
  { key: "ONBOARDING", label: "Onboarding", stepOrder: 11 },
  { key: "EMPLOYEE_FILE", label: "Employee File", stepOrder: 12 },
  { key: "EMPLOYEE_FEEDBACK", label: "Employee Feedback", stepOrder: 13 },
  { key: "CONFIRMATION_PROCESS", label: "Confirmation Process", stepOrder: 14 },
  { key: "CONFIRMATION_LETTER", label: "Confirmation Letter", stepOrder: 15 },
];

// Corporate locations to create/ensure under the Corporate division
const CORPORATE_BRANCHES = [
  { name: "Kolkata Head Office", code: "KOL-HO" },
  { name: "Delhi Head Office", code: "DEL-HO" },
  { name: "Central Lab", code: "CTRL-LAB" },
  { name: "Udayayan Lab", code: "UDYN-LAB" },
  { name: "Gemini", code: "GEMINI" },
  { name: "Primawave", code: "PRIMAWAVE" },
  { name: "Delhi", code: "DELHI-CORP" },
];

export async function POST() {
  const log: string[] = [];

  // 1. Seed WorkflowStages (idempotent)
  for (const stage of STAGES) {
    const existing = await prisma.workflowStage.findUnique({ where: { key: stage.key } });
    if (!existing) {
      await prisma.workflowStage.create({ data: stage });
      log.push(`Created WorkflowStage: ${stage.key}`);
    } else {
      log.push(`WorkflowStage ${stage.key} already exists — skipped`);
    }
  }

  // 2. Corporate Division restructure under India
  const india = await prisma.country.findFirst({ where: { locationType: "INDIA" } });
  if (!india) {
    log.push("India country not found — skipping Corporate restructure");
    return NextResponse.json({ success: true, log });
  }

  // Ensure "Corporate" division under India
  let corporateDiv = await prisma.division.findFirst({
    where: { countryId: india.id, name: "Corporate" },
  });
  if (!corporateDiv) {
    corporateDiv = await prisma.division.create({
      data: { name: "Corporate", countryId: india.id },
    });
    log.push("Created 'Corporate' Division under India");
  } else {
    log.push("'Corporate' Division under India already exists — skipped");
  }

  // Create or update each corporate branch linked to this division
  for (const b of CORPORATE_BRANCHES) {
    const existing = await prisma.branch.findFirst({ where: { code: b.code } });
    if (existing) {
      if (existing.divisionId !== corporateDiv.id || existing.countryId !== india.id) {
        await prisma.branch.update({
          where: { id: existing.id },
          data: { divisionId: corporateDiv.id, countryId: india.id },
        });
        log.push(`Updated branch '${b.name}' (${b.code}) → Corporate Division under India`);
      } else {
        log.push(`Branch '${b.name}' (${b.code}) already linked correctly — skipped`);
      }
    } else {
      await prisma.branch.create({
        data: {
          name: b.name,
          code: b.code,
          countryId: india.id,
          divisionId: corporateDiv.id,
        },
      });
      log.push(`Created branch '${b.name}' (${b.code}) under Corporate Division`);
    }
  }

  return NextResponse.json({ success: true, log });
}
