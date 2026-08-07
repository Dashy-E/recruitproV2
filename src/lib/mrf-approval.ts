import { db } from "@/lib/db";
import { ApprovalLevel, STATUS_TO_APPROVAL_LEVELS } from "@/lib/permissions";
import { filterUsersByOrgAccess, userHasOrgAccess } from "@/lib/org-access";

async function isDepartmentFunctionalHead(userId: string, departmentId: string): Promise<boolean> {
  const row = await db("RECRUIT_T_DepartmentFunctionalHead").where({ userId, departmentId }).first();
  return !!row;
}

// Single source of truth for "can this user act on this MRF right now" —
// shared by the approve-authorization check and the notification fan-out
// below, so the two can never drift out of sync.
export async function userCanActOnMrf(
  userId: string,
  approvalLevel: ApprovalLevel | null,
  mrf: { status: string; orgUnitId: string; departmentId: string }
): Promise<boolean> {
  if (!approvalLevel) return false;
  if (approvalLevel === "ANY") return true;

  const allowedLevels = STATUS_TO_APPROVAL_LEVELS[mrf.status] || [];
  if (!allowedLevels.includes(approvalLevel)) return false;

  if (approvalLevel === "FUNCTIONAL" && !(await isDepartmentFunctionalHead(userId, mrf.departmentId))) {
    return false;
  }

  return userHasOrgAccess(userId, mrf.orgUnitId);
}

// True only if this user's own (non-ANY) role level genuinely matches the
// MRF's current stage and passes the org/department checks — excludes the
// separate "ANY" universal-approver bypass, so callers can distinguish "this
// is actually my assigned stage" from "I can act on anything as HR/ADMIN".
// Used to decide UI state (show the Approve button, self-approval framing)
// consistently with the real authorization check in userCanActOnMrf.
export async function isDesignatedApproverForStage(
  userId: string,
  approvalLevel: ApprovalLevel | null,
  mrf: { status: string; orgUnitId: string; departmentId: string }
): Promise<boolean> {
  if (!approvalLevel || approvalLevel === "ANY") return false;
  const allowedLevels = STATUS_TO_APPROVAL_LEVELS[mrf.status] || [];
  if (!allowedLevels.includes(approvalLevel)) return false;
  return userCanActOnMrf(userId, approvalLevel, mrf);
}

// Active users eligible to act at any of `levels` for this MRF — used to
// pick notification recipients. Mirrors userCanActOnMrf's rules: ANY-level
// users bypass org/department checks, FUNCTIONAL-level users are additionally
// filtered to the MRF's department's registered functional head(s).
//
// includeUniversal controls whether ANY-level users (HR/ADMIN-style
// universal approvers) are included alongside the stage-specific approvers.
// Defaults to true, matching the existing auto-notification behavior
// (HR/ADMIN get notified at every stage, since they genuinely can act on
// any of them). Pass false for UI surfaces meant to show only "the actual
// approver(s) for this stage" (e.g. the send-to-next-approver dropdown).
export async function getEligibleApprovers(
  mrf: { orgUnitId: string; departmentId: string },
  levels: ApprovalLevel[],
  includeUniversal: boolean = true
): Promise<{ id: string; email: string; name: string; approvalLevel: ApprovalLevel }[]> {
  if (levels.length === 0) return [];

  const candidates = await db("RECRUIT_T_User as u")
    .join("RECRUIT_T_Role as r", "r.key", "u.role")
    .where("u.isActive", 1)
    .where((qb) => {
      qb.whereIn("r.approvalLevel", levels);
      if (includeUniversal) qb.orWhere("r.approvalLevel", "ANY");
    })
    .select("u.id", "u.email", "u.name", "r.approvalLevel");

  const universal = candidates.filter((c: any) => c.approvalLevel === "ANY");
  const scoped = candidates.filter((c: any) => c.approvalLevel !== "ANY");

  const orgFiltered = await filterUsersByOrgAccess(scoped, mrf.orgUnitId);

  const functionalHeadIds = new Set(
    (
      await db("RECRUIT_T_DepartmentFunctionalHead")
        .where({ departmentId: mrf.departmentId })
        .whereIn(
          "userId",
          orgFiltered.filter((c: any) => c.approvalLevel === "FUNCTIONAL").map((c: any) => c.id)
        )
        .select("userId")
    ).map((r: any) => r.userId)
  );

  const eligible = orgFiltered.filter((c: any) => c.approvalLevel !== "FUNCTIONAL" || functionalHeadIds.has(c.id));

  return [...universal, ...eligible];
}
