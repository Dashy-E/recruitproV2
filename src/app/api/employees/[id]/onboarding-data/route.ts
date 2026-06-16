import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function checkAccess(employeeId: string, role: string, userId: string): Promise<boolean> {
  if (["ADMIN", "HR"].includes(role)) return true;
  if (role !== "EMPLOYEE") return false;
  // Check employee belongs to this user
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT e.id FROM Employee e
     JOIN Candidate c ON c.id = e.candidateId
     WHERE e.id = ? AND c.userId = ?`,
    employeeId, userId
  );
  return rows.length > 0;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = (session.user as { role?: string })?.role || "";
  const userId = (session.user as { id?: string })?.id || "";

  if (!(await checkAccess(id, role, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM EmployeeOnboardingData WHERE employeeId = ? LIMIT 1`, id
    );
    if (!rows.length) return NextResponse.json(null);
    const row = rows[0];
    return NextResponse.json({ ...row, formData: JSON.parse(row.formData) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET onboarding-data error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = (session.user as { role?: string })?.role || "";
  const userId = (session.user as { id?: string })?.id || "";

  if (!(await checkAccess(id, role, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const formDataJson = JSON.stringify(body);
    const now = new Date().toISOString();

    // Check if record exists
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM EmployeeOnboardingData WHERE employeeId = ? LIMIT 1`, id
    );

    if (existing.length > 0) {
      await prisma.$queryRawUnsafe(
        `UPDATE EmployeeOnboardingData SET formData = ?, updatedAt = ? WHERE employeeId = ?`,
        formDataJson, now, id
      );
    } else {
      const newId = `eod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await prisma.$queryRawUnsafe(
        `INSERT INTO EmployeeOnboardingData (id, employeeId, formData, submittedAt, updatedAt)
         VALUES (?, ?, ?, ?, ?)`,
        newId, id, formDataJson, now, now
      );
    }

    return NextResponse.json({ success: true, formData: body });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("POST onboarding-data error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
