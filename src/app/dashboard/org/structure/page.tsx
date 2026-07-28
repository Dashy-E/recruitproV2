"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, ChevronRight, ChevronDown, Pencil, Trash2, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildOrgTree, OrgUnitFlat, OrgTreeNode } from "@/components/org-unit-picker";

export default function OrgStructurePage() {
  const [units, setUnits] = useState<OrgUnitFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [addParentId, setAddParentId] = useState<string | null | undefined>(undefined);
  const [addName, setAddName] = useState("");

  const [editUnit, setEditUnit] = useState<OrgUnitFlat | null>(null);
  const [editName, setEditName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [editIsActive, setEditIsActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState<Record<string, string>>({});

  const fetchUnits = () =>
    fetch("/api/org-units")
      .then((r) => r.json())
      .then((d) => { setUnits(Array.isArray(d) ? d : []); setLoading(false); });

  useEffect(() => { fetchUnits(); }, []);

  const tree = buildOrgTree(units);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openAdd = (parentId: string | null) => {
    setAddParentId(parentId);
    setAddName("");
    setError("");
  };

  const handleAdd = async () => {
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/org-units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: addName, parentId: addParentId || null }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create org unit.");
      return;
    }
    if (addParentId) setExpanded((prev) => new Set(prev).add(addParentId));
    setAddParentId(undefined);
    fetchUnits();
  };

  const openEdit = (unit: OrgUnitFlat) => {
    setEditUnit(unit);
    setEditName(unit.name);
    setEditSortOrder(String(unit.sortOrder));
    setEditIsActive(unit.isActive);
    setError("");
  };

  const handleEdit = async () => {
    if (!editUnit) return;
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/org-units/${editUnit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, sortOrder: parseInt(editSortOrder) || 0, isActive: editIsActive }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update org unit.");
      return;
    }
    setEditUnit(null);
    fetchUnits();
  };

  const handleDelete = async (id: string) => {
    setDeleteError((prev) => ({ ...prev, [id]: "" }));
    const res = await fetch(`/api/org-units/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleteError((prev) => ({ ...prev, [id]: data.error || "Delete failed." }));
      return;
    }
    fetchUnits();
  };

  const OrgRow = ({ node, depth }: { node: OrgTreeNode; depth: number }) => {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);
    return (
      <div>
        <div
          className="group flex items-center gap-1 rounded-md py-1.5 pr-2 hover:bg-gray-50"
          style={{ paddingLeft: `${depth * 20 + 4}px` }}
        >
          <button
            onClick={() => hasChildren && toggleExpand(node.id)}
            className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-400"
          >
            {hasChildren ? (isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : null}
          </button>
          <span className={cn("flex-1 text-sm", !node.isActive && "text-gray-400 italic")}>
            {node.name}
            {!node.isActive && <span className="ml-2 text-xs">(inactive)</span>}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => openAdd(node.id)} className="p-1 text-gray-400 hover:text-blue-600" title="Add child">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => openEdit(node)} className="p-1 text-gray-400 hover:text-blue-600" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => handleDelete(node.id)} className="p-1 text-gray-400 hover:text-red-600" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {deleteError[node.id] && (
          <p className="text-xs text-red-500" style={{ paddingLeft: `${depth * 20 + 30}px` }}>{deleteError[node.id]}</p>
        )}
        {hasChildren && isOpen && node.children.map((child) => <OrgRow key={child.id} node={child} depth={depth + 1} />)}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Organization Structure</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage the organization hierarchy used for MRF location and user access. Add or reorganize nodes at any depth.
          </p>
        </div>
        <Button onClick={() => openAdd(null)}><Plus className="h-4 w-4" /> Add Root Unit</Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-2">
        {loading ? (
          <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>
        ) : tree.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Network className="mx-auto h-10 w-10 text-gray-300 mb-2" />
            <p>No org units yet.</p>
          </div>
        ) : (
          tree.map((node) => <OrgRow key={node.id} node={node} depth={0} />)
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={addParentId !== undefined} onOpenChange={(open) => !open && setAddParentId(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{addParentId ? "Add Child Unit" : "Add Root Unit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. Mumbai" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddParentId(undefined)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!addName.trim() || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editUnit} onOpenChange={(open) => !open && setEditUnit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Org Unit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input type="number" value={editSortOrder} onChange={(e) => setEditSortOrder(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} className="h-4 w-4" />
              <span className="text-sm">Active</span>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUnit(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!editName.trim() || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
