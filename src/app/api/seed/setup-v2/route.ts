import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";

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

export async function POST() {
  const log: string[] = [];
  const now = new Date();

  // Seed WorkflowStages (idempotent)
  for (const stage of STAGES) {
    const existing = await db("RECRUIT_T_WorkflowStage").where({ key: stage.key }).first();
    if (!existing) {
      await db("RECRUIT_T_WorkflowStage").insert({ id: newId(), ...stage, createdAt: now, updatedAt: now });
      log.push(`Created WorkflowStage: ${stage.key}`);
    } else {
      log.push(`WorkflowStage ${stage.key} already exists — skipped`);
    }
  }

  return NextResponse.json({ success: true, log });
}
