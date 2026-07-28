"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OrgUnitFlat {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface OrgTreeNode extends OrgUnitFlat {
  children: OrgTreeNode[];
}

export function buildOrgTree(flat: OrgUnitFlat[]): OrgTreeNode[] {
  const byParent = new Map<string | null, OrgUnitFlat[]>();
  for (const unit of flat) {
    const siblings = byParent.get(unit.parentId) ?? [];
    siblings.push(unit);
    byParent.set(unit.parentId, siblings);
  }
  function attach(parentId: string | null): OrgTreeNode[] {
    return (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((u) => ({ ...u, children: attach(u.id) }));
  }
  return attach(null);
}

function findAncestorIds(nodes: OrgTreeNode[], targetIds: Set<string>, acc = new Set<string>()): Set<string> {
  function walk(node: OrgTreeNode, ancestors: string[]): boolean {
    const isMatch = targetIds.has(node.id);
    let childMatched = false;
    for (const child of node.children) {
      if (walk(child, [...ancestors, node.id])) childMatched = true;
    }
    if (isMatch || childMatched) {
      for (const a of ancestors) acc.add(a);
      return true;
    }
    return false;
  }
  for (const node of nodes) walk(node, []);
  return acc;
}

interface OrgUnitPickerProps {
  nodes: OrgTreeNode[];
  mode: "single" | "multi";
  value: string | string[];
  onChange: (value: string | string[]) => void;
  className?: string;
  // Restrict selection to leaf nodes (no children) — used where a location
  // must be a specific place, not an umbrella node like "India" or "SW".
  // Nodes with children can still be expanded, just not selected.
  leafOnly?: boolean;
}

export function OrgUnitPicker({ nodes, mode, value, onChange, className, leafOnly }: OrgUnitPickerProps) {
  const selectedIds = useMemo(() => new Set(mode === "multi" ? (value as string[]) : value ? [value as string] : []), [value, mode]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpanded((prev) => new Set([...prev, ...findAncestorIds(nodes, selectedIds)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectNode(id: string) {
    if (mode === "single") {
      onChange(id);
    } else {
      const current = value as string[];
      onChange(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
    }
  }

  function renderNode(node: OrgTreeNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const isSelected = selectedIds.has(node.id);
    const isSelectable = !leafOnly || !hasChildren;

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded px-1.5 py-1 text-sm hover:bg-gray-50",
            isSelectable ? "cursor-pointer" : "cursor-default text-gray-400",
            isSelected && "bg-blue-50 text-blue-700 font-medium"
          )}
          style={{ paddingLeft: `${depth * 16 + 6}px` }}
          onClick={() => (isSelectable ? selectNode(node.id) : hasChildren && toggleExpand(node.id))}
          title={!isSelectable ? "Has sub-locations — pick a specific one below" : undefined}
        >
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-400"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleExpand(node.id);
            }}
          >
            {hasChildren ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : null}
          </span>
          {mode === "multi" && isSelectable && (
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white"
              )}
            >
              {isSelected && <Check className="h-3 w-3" />}
            </span>
          )}
          <span className={cn(!node.isActive && "text-gray-400 italic")}>{node.name}</span>
        </div>
        {hasChildren && isExpanded && <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>}
      </div>
    );
  }

  if (nodes.length === 0) {
    return <div className={cn("text-sm text-gray-400 p-2", className)}>No org units available.</div>;
  }

  return <div className={cn("max-h-72 overflow-y-auto rounded-md border border-gray-200 p-1", className)}>{nodes.map((n) => renderNode(n, 0))}</div>;
}
