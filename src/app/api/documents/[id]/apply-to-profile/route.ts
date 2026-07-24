import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "MANAGE_DOCUMENTS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const doc = await db("RECRUIT_T_Document").where({ id }).first();
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!doc.extractedData) return NextResponse.json({ error: "No extracted data on this document" }, { status: 400 });

  const candidate = doc.candidateId ? await db("RECRUIT_T_Candidate").where({ id: doc.candidateId }).first() : null;
  const employee = candidate ? await db("RECRUIT_T_Employee").where({ candidateId: candidate.id }).first() : null;
  if (!employee) return NextResponse.json({ error: "No employee record linked to this candidate" }, { status: 400 });

  let extracted: Record<string, string>;
  try {
    extracted = JSON.parse(doc.extractedData);
  } catch {
    return NextResponse.json({ error: "Extracted data is not valid JSON" }, { status: 400 });
  }

  const employeeId = employee.id;

  const existing = await db("RECRUIT_T_EmployeeOnboardingData").where({ employeeId }).first();
  let currentPayload: Record<string, unknown> = {};
  if (existing) {
    try { currentPayload = JSON.parse(existing.formData); } catch { /* ignore */ }
  }

  const mergedFormData = { ...(currentPayload.formData as Record<string, string> || {}), ...extracted };
  const newPayload = { ...currentPayload, formData: mergedFormData };
  const now = new Date();

  if (existing) {
    await db("RECRUIT_T_EmployeeOnboardingData")
      .where({ employeeId })
      .update({ formData: JSON.stringify(newPayload), updatedAt: now });
  } else {
    await db("RECRUIT_T_EmployeeOnboardingData").insert({
      id: newId(),
      employeeId,
      formData: JSON.stringify(newPayload),
      submittedAt: now,
      updatedAt: now,
    });
  }

  return NextResponse.json({ success: true, appliedFields: Object.keys(extracted) });
}
