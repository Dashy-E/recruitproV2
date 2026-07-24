"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Lock } from "lucide-react";

const PERMISSIONS: Record<string, string> = {
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
};

const NO_APPROVAL_LEVEL = "NONE";

const APPROVAL_LEVELS = [
  { value: NO_APPROVAL_LEVEL, label: "None — doesn't approve MRFs" },
  { value: "DIVISIONAL", label: "Divisional" },
  { value: "FUNCTIONAL", label: "Functional" },
  { value: "COUNTRY", label: "Country" },
  { value: "ANY", label: "Any level (universal approver)" },
];

interface Role {
  id: string;
  key: string;
  label: string;
  approvalLevel: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: string[];
}

const emptyForm = { key: "", label: "", approvalLevel: NO_APPROVAL_LEVEL, permissions: [] as string[] };

export default function RolesSettingsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState("");

  const [editRole, setEditRole] = useState<Role | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchRoles = () => {
    fetch("/api/roles")
      .then((r) => r.json())
      .then((d) => { setRoles(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => { fetchRoles(); }, []);

  const togglePermission = (list: string[], key: string) =>
    list.includes(key) ? list.filter((p) => p !== key) : [...list, key];

  const handleAdd = async () => {
    setAddError("");
    setAddSubmitting(true);
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addForm, approvalLevel: addForm.approvalLevel === NO_APPROVAL_LEVEL ? null : addForm.approvalLevel }),
    });
    setAddSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setAddError(data.error || "Failed to create role.");
      return;
    }
    setShowAdd(false);
    setAddForm(emptyForm);
    fetchRoles();
  };

  const openEdit = (role: Role) => {
    setEditRole(role);
    setEditForm({ key: role.key, label: role.label, approvalLevel: role.approvalLevel || NO_APPROVAL_LEVEL, permissions: role.permissions });
    setEditError("");
  };

  const handleEdit = async () => {
    if (!editRole) return;
    setEditError("");
    setEditSubmitting(true);
    const res = await fetch(`/api/roles/${editRole.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: editForm.label,
        approvalLevel: editForm.approvalLevel === NO_APPROVAL_LEVEL ? null : editForm.approvalLevel,
        permissions: editForm.permissions,
      }),
    });
    setEditSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setEditError(data.error || "Failed to update role.");
      return;
    }
    setEditRole(null);
    fetchRoles();
  };

  const toggleActive = async (role: Role) => {
    await fetch(`/api/roles/${role.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !role.isActive }),
    });
    fetchRoles();
  };

  const handleDelete = async (role: Role) => {
    setError("");
    const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to delete role.");
      return;
    }
    fetchRoles();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Roles & Permissions</h2>
            <p className="text-sm text-gray-500">Create custom roles and control what each role can access</p>
          </div>
        </div>
        <Button onClick={() => { setAddForm(emptyForm); setAddError(""); setShowAdd(true); }}>
          <Plus className="h-4 w-4" /> Add Role
        </Button>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {roles.map((role) => (
                <div key={role.id} className={`px-4 py-3 ${!role.isActive ? "bg-gray-50 opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{role.label}</p>
                        <span className="text-xs text-gray-400 font-mono">{role.key}</span>
                        {role.isSystem && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Lock className="h-3 w-3" /> built-in
                          </span>
                        )}
                        {role.approvalLevel && (
                          <Badge variant="secondary">{role.approvalLevel === "ANY" ? "Universal approver" : `${role.approvalLevel} approver`}</Badge>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {role.permissions.length === 0 ? (
                          <span className="text-xs text-gray-400">No permissions assigned</span>
                        ) : (
                          role.permissions.map((p) => (
                            <span key={p} className="rounded-full bg-blue-50 text-blue-700 text-xs px-2 py-0.5">
                              {PERMISSIONS[p] || p}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleActive(role)}
                        disabled={role.key === "ADMIN"}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 focus:outline-none disabled:opacity-40
                          ${role.isActive ? "bg-blue-600" : "bg-gray-300"}`}
                        title="Active"
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${role.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(role)} disabled={role.key === "ADMIN"}>
                        <Pencil className="h-3.5 w-3.5 text-gray-400" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-8 w-8 p-0"
                        onClick={() => handleDelete(role)}
                        disabled={role.isSystem}
                        title={role.isSystem ? "Built-in roles cannot be deleted" : "Delete role"}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Role Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); setAddError(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Role</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Label *</Label>
              <Input value={addForm.label} onChange={(e) => setAddForm({ ...addForm, label: e.target.value })} placeholder="e.g. Recruiter" />
            </div>
            <div className="space-y-1">
              <Label>Key *</Label>
              <Input value={addForm.key} onChange={(e) => setAddForm({ ...addForm, key: e.target.value })} placeholder="e.g. RECRUITER" autoComplete="off" />
              <p className="text-xs text-gray-400">Stable identifier — uppercase, no spaces. Cannot be changed later.</p>
            </div>
            <div className="space-y-1">
              <Label>MRF Approval Level</Label>
              <Select value={addForm.approvalLevel} onValueChange={(v) => setAddForm({ ...addForm, approvalLevel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPROVAL_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PERMISSIONS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={addForm.permissions.includes(key)}
                      onChange={() => setAddForm({ ...addForm, permissions: togglePermission(addForm.permissions, key) })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {addError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{addError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!addForm.key || !addForm.label || addSubmitting}>
              {addSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editRole} onOpenChange={(open) => { if (!open) setEditRole(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Role — {editRole?.label}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Label *</Label>
              <Input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Key</Label>
              <Input value={editForm.key} disabled className="opacity-60" />
            </div>
            <div className="space-y-1">
              <Label>MRF Approval Level</Label>
              <Select value={editForm.approvalLevel} onValueChange={(v) => setEditForm({ ...editForm, approvalLevel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPROVAL_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PERMISSIONS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={editForm.permissions.includes(key)}
                      onChange={() => setEditForm({ ...editForm, permissions: togglePermission(editForm.permissions, key) })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {editError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{editError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRole(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!editForm.label || editSubmitting}>
              {editSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
