import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllOrgUnits, expandDescendantsSync, getAncestorPath, OrgUnitRow } from "@/lib/org-access";

interface TreeNode extends OrgUnitRow {
  children: TreeNode[];
}

function buildTree(units: OrgUnitRow[], allowedIds: Set<string> | null): TreeNode[] {
  const byParent = new Map<string | null, OrgUnitRow[]>();
  for (const unit of units) {
    if (allowedIds && !allowedIds.has(unit.id)) continue;
    const siblings = byParent.get(unit.parentId) ?? [];
    siblings.push(unit);
    byParent.set(unit.parentId, siblings);
  }

  function attach(parentId: string | null): TreeNode[] {
    return (byParent.get(parentId) ?? [])
      .filter((u) => u.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((u) => ({ ...u, children: attach(u.id) }));
  }

  return attach(null);
}

// Returns the org tree pruned to what the requester can access: the full
// active tree for a user with no org-unit assignments (today's ADMIN/HR
// behavior), otherwise just the ancestor path down to each assigned node
// plus everything beneath it — so the sidebar can render e.g. "India > SW >
// Mumbai" with context instead of a bare orphaned "Mumbai" node.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgUnitIds = ((session.user as { orgUnitIds?: string[] })?.orgUnitIds) || [];
  const units = await getAllOrgUnits();

  if (orgUnitIds.length === 0) {
    return NextResponse.json(buildTree(units, null));
  }

  const descendantIds = new Set(expandDescendantsSync(orgUnitIds, units));
  const allowedIds = new Set(descendantIds);
  for (const rootId of orgUnitIds) {
    for (const ancestor of getAncestorPath(rootId, units)) {
      allowedIds.add(ancestor.id);
    }
  }

  return NextResponse.json(buildTree(units, allowedIds));
}
