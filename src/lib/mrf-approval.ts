import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { ApprovalLevel, STATUS_TO_APPROVAL_LEVELS } from "@/lib/permissions";
import { filterUsersByOrgAccess, userHasOrgAccess } from "@/lib/org-access";

async function isDepartmentFunctionalHead(userId: string, departmentId: string): Promise<boolean> {
  const row = await db("RECRUIT_T_DepartmentFunctionalHead").where({ userId, departmentId }).first();
  return !!row;
}

// Single source of truth for the stage sequence — shared by the approve
// endpoint and by creation/restart (which need to know the order to compute
// hierarchy-based skips, see computeInitialMrfState below).
export const MRF_STAGE_ORDER = ["PENDING_DIVISIONAL", "PENDING_COUNTRY_SUPERVISOR", "PENDING_FUNCTIONAL"] as const;

export const STATUS_FLOW: Record<string, string> = {
  PENDING_DIVISIONAL: "PENDING_COUNTRY_SUPERVISOR",
  PENDING_COUNTRY_SUPERVISOR: "PENDING_FUNCTIONAL",
  PENDING_FUNCTIONAL: "APPROVED",
};

// Display/grouping label stored on RECRUIT_T_MRFApprovalRecord.level — the
// STAGE, not the specific role that acted (stage 1 accepts either a
// Divisional or a Country Manager; approverRole separately records who
// actually approved/auto-approved).
export const STAGE_LEVEL_LABEL: Record<string, string> = {
  PENDING_DIVISIONAL: "DIVISIONAL_MANAGER",
  PENDING_COUNTRY_SUPERVISOR: "COUNTRY_SUPERVISOR",
  PENDING_FUNCTIONAL: "FUNCTIONAL_HEAD",
};

// Organizational seniority for creation-time self-approval skipping — a
// Country Supervisor outranks stage 1, a Functional Head outranks
// everything. ANY and unranked levels (HR/ADMIN/Branch Manager/etc.) rank 0,
// meaning no skipping (unchanged full chain starting at stage 1).
const HIERARCHY_RANK: Partial<Record<ApprovalLevel, number>> = {
  DIVISIONAL: 1,
  COUNTRY: 1,
  COUNTRY_SUPERVISOR: 2,
  FUNCTIONAL: 3,
};

const STAGE_RANK: Record<string, number> = {
  PENDING_DIVISIONAL: 1,
  PENDING_COUNTRY_SUPERVISOR: 2,
  PENDING_FUNCTIONAL: 3,
};

export interface InitialMrfState {
  status: string; // one of MRF_STAGE_ORDER, or "APPROVED" if every stage was skipped
  skippedStages: string[]; // subset of MRF_STAGE_ORDER, in order
}

// Where a new (or restarted) MRF should enter the approval chain, given the
// approvalLevel of whoever is raising it — stages at or below their own
// hierarchy rank are skipped (self-approved), since a more senior person
// doesn't need sign-off from an equal-or-lower rank. Used at creation
// (src/app/api/mrfs/route.ts) and restart (src/app/api/mrfs/[id]/restart/route.ts).
export function computeInitialMrfState(creatorApprovalLevel: ApprovalLevel | null): InitialMrfState {
  const rank = (creatorApprovalLevel && HIERARCHY_RANK[creatorApprovalLevel]) || 0;
  if (rank === 0) return { status: MRF_STAGE_ORDER[0], skippedStages: [] };

  const skippedStages = MRF_STAGE_ORDER.filter((s) => STAGE_RANK[s] <= rank);
  const remaining = MRF_STAGE_ORDER.filter((s) => STAGE_RANK[s] > rank);
  return { status: remaining[0] || "APPROVED", skippedStages };
}

// Records the hierarchy-based skip as real approval-record rows (not a
// special-cased flag), so the existing Approval Progress timeline and PDF
// signature blocks — which both key off RECRUIT_T_MRFApprovalRecord — render
// them correctly with no changes needed there.
export async function insertAutoApprovalRecords(
  dbOrTrx: typeof db,
  mrfId: string,
  skippedStages: string[],
  actor: { id: string; name: string; role: string }
): Promise<void> {
  if (skippedStages.length === 0) return;
  const now = new Date();
  await dbOrTrx("RECRUIT_T_MRFApprovalRecord").insert(
    skippedStages.map((stage) => ({
      id: newId(),
      mrfId,
      level: STAGE_LEVEL_LABEL[stage],
      approverRole: actor.role,
      approverName: actor.name,
      approverId: actor.id,
      status: "APPROVED",
      notes: "Auto-approved — raised by the approver themselves, who outranks this stage.",
      recordedById: actor.id,
      recordedAt: now,
      isAutoApproved: 1,
    }))
  );
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
