import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { candidate: { include: { employee: true } } },
  });

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!doc.extractedData) return NextResponse.json({ error: "No extracted data on this document" }, { status: 400 });
  if (!doc.candidate?.employee) return NextResponse.json({ error: "No employee record linked to this candidate" }, { status: 400 });

  let extracted: Record<string, string>;
  try {
    extracted = JSON.parse(doc.extractedData);
  } catch {
    return NextResponse.json({ error: "Extracted data is not valid JSON" }, { status: 400 });
  }

  const employeeId = doc.candidate.employee.id;

  const existing = await prisma.employeeOnboardingData.findUnique({ where: { employeeId } });
  let currentPayload: Record<string, unknown> = {};
  if (existing) {
    try { currentPayload = JSON.parse(existing.formData); } catch { /* ignore */ }
  }

  const mergedFormData = { ...(currentPayload.formData as Record<string, string> || {}), ...extracted };
  const newPayload = { ...currentPayload, formData: mergedFormData };

  await prisma.employeeOnboardingData.upsert({
    where: { employeeId },
    create: { employeeId, formData: JSON.stringify(newPayload) },
    update: { formData: JSON.stringify(newPayload) },
  });

  return NextResponse.json({ success: true, appliedFields: Object.keys(extracted) });
}