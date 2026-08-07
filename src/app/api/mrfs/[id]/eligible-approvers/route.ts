import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission, STATUS_TO_APPROVAL_LEVELS } from "@/lib/permissions";
import { getEligibleApprovers } from "@/lib/mrf-approval";

// Who's eligible to act on this MRF at its current pending stage — same
// org/department-scoped rules used to pick notification recipients (see
// src/lib/mrf-approval.ts), surfaced here so the "send to next approver"
// dialog can offer a dropdown instead of a free-text email.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "SEND_MRF_APPROVAL_EMAIL")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const mrf = await db("RECRUIT_T_MRF").where({ id }).select("id", "status", "orgUnitId", "departmentId").first();
  if (!mrf) return NextResponse.json({ error: "MRF not found" }, { status: 404 });

  const levels = STATUS_TO_APPROVAL_LEVELS[mrf.status] || [];
  // Stage-specific approvers only — HR/ADMIN-style universal approvers are
  // deliberately excluded here even though they can technically act on any
  // stage, since this list drives a "who's the actual approver" dropdown.
  const approvers = await getEligibleApprovers(mrf, levels, false);

  return NextResponse.json(approvers.map((a) => ({ id: a.id, name: a.name, email: a.email })));
}
