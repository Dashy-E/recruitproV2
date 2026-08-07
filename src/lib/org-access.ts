import { db } from "@/lib/db";

export interface OrgUnitRow {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
}

// A plain JS tree walk over the whole (small) org-unit table, rather than an
// Oracle recursive CTE/CONNECT BY through Knex — this project has already
// hit sharp, hard-to-debug Knex+oracledb TS-inference edges elsewhere, so a
// cached in-memory walk is the simpler and safer option here.
export async function getAllOrgUnits(): Promise<OrgUnitRow[]> {
  const rows = await db("RECRUIT_T_OrgUnit").select("id", "name", "parentId", "isActive", "sortOrder");
  return rows.map((r: any) => ({ ...r, isActive: !!r.isActive }));
}

function buildChildrenMap(units: OrgUnitRow[]): Map<string | null, OrgUnitRow[]> {
  const map = new Map<string | null, OrgUnitRow[]>();
  for (const unit of units) {
    const siblings = map.get(unit.parentId) ?? [];
    siblings.push(unit);
    map.set(unit.parentId, siblings);
  }
  return map;
}

// All ids in rootIds plus every descendant reachable from them.
export function expandDescendantsSync(rootIds: string[], units: OrgUnitRow[]): string[] {
  const childrenOf = buildChildrenMap(units);
  const seen = new Set<string>();
  const queue = [...rootIds];
  while (queue.length) {
    const id = queue.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const child of childrenOf.get(id) ?? []) queue.push(child.id);
  }
  return [...seen];
}

export async function expandDescendants(rootIds: string[]): Promise<string[]> {
  if (rootIds.length === 0) return [];
  const units = await getAllOrgUnits();
  return expandDescendantsSync(rootIds, units);
}

// null means "unrestricted" — the user has no org-unit assignments, so every
// existing role (ADMIN/HR today) keeps seeing everything, unchanged.
export async function getAccessibleOrgUnitIds(orgUnitIds: string[] | undefined | null): Promise<string[] | null> {
  if (!orgUnitIds || orgUnitIds.length === 0) return null;
  return expandDescendants(orgUnitIds);
}

export function getAncestorPath(unitId: string, units: OrgUnitRow[]): OrgUnitRow[] {
  const byId = new Map(units.map((u) => [u.id, u]));
  const path: OrgUnitRow[] = [];
  let current = byId.get(unitId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

// Whether a single user's org-unit assignment covers targetOrgUnitId (or one
// of its descendants is the target — i.e. the user manages targetOrgUnitId
// or an ancestor of it). No assignment at all means unrestricted (true).
export async function userHasOrgAccess(userId: string, targetOrgUnitId: string): Promise<boolean> {
  const [user] = await filterUsersByOrgAccess([{ id: userId }], targetOrgUnitId);
  return !!user;
}

// Narrows a candidate recipient list to users whose org-unit assignment
// covers targetOrgUnitId — i.e. the user manages targetOrgUnitId or one of
// its ancestors. Users with no org-unit assignment are unrestricted (same
// convention as getAccessibleOrgUnitIds) and always pass. Used to scope
// MRF notifications to the org structure instead of blasting every user
// with a matching role.
export async function filterUsersByOrgAccess<T extends { id: string }>(
  candidates: T[],
  targetOrgUnitId: string
): Promise<T[]> {
  if (candidates.length === 0) return [];

  const units = await getAllOrgUnits();
  const ancestorIds = new Set(getAncestorPath(targetOrgUnitId, units).map((u) => u.id));

  const assignments = await db("RECRUIT_T_UserOrgUnit")
    .whereIn("userId", candidates.map((c) => c.id))
    .select("userId", "orgUnitId");

  const assignedByUser = new Map<string, string[]>();
  for (const a of assignments) {
    const list = assignedByUser.get(a.userId) ?? [];
    list.push(a.orgUnitId);
    assignedByUser.set(a.userId, list);
  }

  return candidates.filter((c) => {
    const assigned = assignedByUser.get(c.id);
    if (!assigned || assigned.length === 0) return true; // unrestricted
    return assigned.some((id) => ancestorIds.has(id));
  });
}
