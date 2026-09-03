export const PERMISSIONS = {
  MANAGE_USERS: "Manage Users",
  MANAGE_CANDIDATES: "Manage Candidates",
  MANAGE_DOCUMENTS: "Manage Documents",
  MANAGE_EMPLOYEES: "Manage Employees",
  MANAGE_EMAILS: "Manage Emails",
  VIEW_REPORTS: "View Reports",
  MANAGE_ORG: "Manage Organization",
  MANAGE_SETTINGS: "Manage Settings",
  MANAGE_ROLES: "Manage Roles",
  CREATE_MRF: "Create MRFs",
  MANAGE_MRF: "Edit / Restart MRFs",
  SEND_MRF_APPROVAL_EMAIL: "Send MRF Approval Emails",
  SKIP_MRF_APPROVAL: "Skip MRF Approval Level",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const APPROVAL_LEVELS = {
  DIVISIONAL: "Divisional",
  FUNCTIONAL: "Functional",
  COUNTRY: "Country",
  COUNTRY_SUPERVISOR: "Country Supervisor",
  ANY: "Any level (universal approver)",
} as const;

export type ApprovalLevel = keyof typeof APPROVAL_LEVELS;

// Stage 1 accepts either a Divisional Manager or a Country Manager (whoever
// has org-unit access to the MRF's location gets to act); stage 2 is the new
// Country Supervisor role; stage 3 (final) is the department-matched
// Functional Head. See src/lib/mrf-approval.ts for the org/department checks
// layered on top of this role-level gate.
export const STATUS_TO_APPROVAL_LEVELS: Record<string, ApprovalLevel[]> = {
  PENDING_DIVISIONAL: ["DIVISIONAL", "COUNTRY"],
  PENDING_COUNTRY_SUPERVISOR: ["COUNTRY_SUPERVISOR"],
  PENDING_FUNCTIONAL: ["FUNCTIONAL"],
};

interface SessionLike {
  // The index signature keeps this structurally compatible with NextAuth's
  // Session["user"] (name/email/image), which otherwise trips TypeScript's
  // "weak type" check since neither side's optional-only properties overlap.
  user?: ({ permissions?: string[] } & Record<string, unknown>) | null;
}

export function hasPermission(session: SessionLike | null | undefined, key: PermissionKey): boolean {
  return !!session?.user?.permissions?.includes(key);
}
