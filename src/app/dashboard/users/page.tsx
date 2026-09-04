"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Loader2, UserCheck, Pencil } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { OrgUnitPicker, OrgTreeNode, buildOrgTree } from "@/components/org-unit-picker";

interface User {
  id: string; name: string; userName: string; email: string; role: string; isActive: boolean; createdAt: string;
  orgUnits: { id: string; name: string; path: string }[];
  departmentId: string | null;
  signatureUrl: string | null;
}

const ALLOWED_SIGNATURE_TYPES = ["image/png", "image/jpeg"];
interface Department { id: string; name: string }
interface Role { id: string; key: string; label: string; isSystem: boolean; isActive: boolean; approvalLevel: string | null; permissions: string[] }

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  HR: "bg-blue-100 text-blue-700",
  BRANCH_MANAGER: "bg-green-100 text-green-700",
  DIVISIONAL_MANAGER: "bg-yellow-100 text-yellow-700",
  COUNTRY_MANAGER: "bg-red-100 text-red-700",
  COUNTRY_SUPERVISOR: "bg-teal-100 text-teal-700",
  FUNCTIONAL_HEAD: "bg-orange-100 text-orange-700",
  CANDIDATE: "bg-gray-100 text-gray-700",
};
const DEFAULT_ROLE_COLOR = "bg-slate-100 text-slate-700";

const ROLE_HINTS: Record<string, string> = {
  HR: "Assign one or more org units (optional)",
  BRANCH_MANAGER: "Assign at least one org unit (required)",
  DIVISIONAL_MANAGER: "Assign one or more org units",
  COUNTRY_MANAGER: "Assign one or more org units",
  COUNTRY_SUPERVISOR: "Assign one or more org units",
  FUNCTIONAL_HEAD: "Assign a department, plus org units (required to approve)",
};

export default function UsersPage() {
  const { data: session } = useSession();
  const myRole = (session?.user as { role?: string })?.role || "";

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [orgTree, setOrgTree] = useState<OrgTreeNode[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", userName: "", email: "", password: "", userRole: "HR",
    orgUnitIds: [] as string[], departmentId: "",
  });

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", userName: "", email: "", userRole: "", orgUnitIds: [] as string[], departmentId: "",
    password: "", confirmPassword: "", isActive: true,
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState("");
  const [deletingSignature, setDeletingSignature] = useState(false);

  const fetchUsers = () => {
    fetch("/api/users").then((r) => r.json()).then((d) => { setUsers(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => {
    fetchUsers();
    fetch("/api/org-units").then((r) => r.json()).then((flat) => setOrgTree(buildOrgTree(Array.isArray(flat) ? flat : [])));
    fetch("/api/org/departments").then((r) => r.json()).then(setDepartments);
    fetch("/api/roles").then((r) => r.json()).then((d) => setRoles(Array.isArray(d) ? d : []));
  }, []);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.userName?.toLowerCase().includes(search.toLowerCase())
  );

  // Roles HR can create (no ADMIN, no CANDIDATE — candidates are created via the candidate flow)
  const creatableRoles = roles
    .filter((r) => r.isActive && r.key !== "CANDIDATE" && (r.key !== "ADMIN" || myRole === "ADMIN"))
    .map((r): [string, string] => [r.key, r.label]);

  // Roles selectable when editing an existing user — includes CANDIDATE since
  // self-signed-up accounts default to it and the admin picks the real role
  // when activating them.
  const editableRoles = roles
    .filter((r) => r.isActive && (r.key !== "ADMIN" || myRole === "ADMIN"))
    .map((r): [string, string] => [r.key, r.label]);

  const handleAdd = async () => {
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setSubmitting(false);
      const data = await res.json();
      setError(data.error || "Failed to create user.");
      return;
    }
    const created = await res.json();
    if (form.orgUnitIds.length > 0) {
      await fetch(`/api/users/${created.id}/org-units`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgUnitIds: form.orgUnitIds }),
      });
    }
    setSubmitting(false);
    setShowAdd(false);
    setForm({ name: "", userName: "", email: "", password: "", userRole: "HR", orgUnitIds: [], departmentId: "" });
    fetchUsers();
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setEditForm({
      name: u.name, userName: u.userName, email: u.email, userRole: u.role,
      orgUnitIds: u.orgUnits.map((o) => o.id),
      departmentId: u.departmentId || "",
      password: "", confirmPassword: "", isActive: u.isActive,
    });
    setEditError("");
    setSignatureFile(null);
    setSignaturePreview(u.signatureUrl);
    setSignatureError("");
  };

  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSignatureError("");
    if (!file) return;
    if (!ALLOWED_SIGNATURE_TYPES.includes(file.type)) {
      setSignatureError("Only PNG, JPG, or JPEG files are accepted.");
      e.target.value = "";
      return;
    }
    setSignatureFile(file);
    setSignaturePreview(URL.createObjectURL(file));
  };

  const handleDeleteSignature = async () => {
    if (!editUser) return;
    setDeletingSignature(true);
    setSignatureError("");
    const res = await fetch(`/api/users/${editUser.id}/signature`, { method: "DELETE" });
    setDeletingSignature(false);
    if (res.ok) {
      setSignatureFile(null);
      setSignaturePreview(null);
    } else {
      const data = await res.json().catch(() => ({}));
      setSignatureError(data.error || "Failed to delete signature.");
    }
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setEditError("");
    setEditSubmitting(true);
    const payload: Record<string, unknown> = {
      name: editForm.name,
      userName: editForm.userName,
      email: editForm.email,
      userRole: editForm.userRole,
      isActive: editForm.isActive,
      departmentId: editForm.userRole === "FUNCTIONAL_HEAD" ? editForm.departmentId : null,
    };
    if (editForm.password) payload.password = editForm.password;
    const requests = [
      fetch(`/api/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      fetch(`/api/users/${editUser.id}/org-units`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgUnitIds: editForm.orgUnitIds }),
      }),
    ];
    if (signatureFile) {
      const fd = new FormData();
      fd.append("file", signatureFile);
      requests.push(fetch(`/api/users/${editUser.id}/signature`, { method: "POST", body: fd }));
    }
    const [res] = await Promise.all(requests);
    setEditSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setEditError(data.error || "Failed to update user.");
      return;
    }
    setEditUser(null);
    fetchUsers();
  };

  const editPasswordsMatch = editForm.password === editForm.confirmPassword;

  const needsDept = form.userRole === "FUNCTIONAL_HEAD";
  const needsOrgUnit = form.userRole === "BRANCH_MANAGER";
  const editNeedsDept = editForm.userRole === "FUNCTIONAL_HEAD";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-1">{users.length} users in system</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* Role Summary */}
      <div className="flex flex-wrap gap-3">
        {roles.filter((r) => r.isActive && r.key !== "CANDIDATE").map((r) => (
          <div key={r.key} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${ROLE_COLORS[r.key] || DEFAULT_ROLE_COLOR}`}>
            <UserCheck className="h-4 w-4" />
            <span className="text-sm font-medium">{r.label}</span>
            <span className="font-bold">{users.filter((u) => u.role === r.key).length}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoComplete="off"
              name="user-search"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Org Units</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm text-gray-500">{u.userName}</TableCell>
                    <TableCell className="text-sm text-gray-500">{u.email}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] || DEFAULT_ROLE_COLOR}`}>
                        {roles.find((r) => r.key === u.role)?.label || u.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 max-w-[220px]">
                      {u.orgUnits.length === 0
                        ? "—"
                        : u.orgUnits.length <= 2
                        ? u.orgUnits.map((o) => o.path || o.name).join(", ")
                        : <span title={u.orgUnits.map((o) => o.path || o.name).join(", ")}>{u.orgUnits[0].name} +{u.orgUnits.length - 1} more</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "success" : "secondary"}>
                        {u.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(u.createdAt)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(u)}>
                        <Pencil className="h-3.5 w-3.5 text-gray-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit User — {editUser?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-2">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Username *</Label>
              <Input value={editForm.userName} onChange={(e) => setEditForm({ ...editForm, userName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={editForm.userRole} onValueChange={(v) => setEditForm({ ...editForm, userRole: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {editableRoles.map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ROLE_HINTS[editForm.userRole] && (
                <p className="text-xs text-gray-500">{ROLE_HINTS[editForm.userRole]}</p>
              )}
            </div>

            {editNeedsDept && (
              <div className="space-y-1">
                <Label>Department *</Label>
                <Select value={editForm.departmentId} onValueChange={(v) => setEditForm({ ...editForm, departmentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">Determines which MRFs (by department) this Functional Head can approve.</p>
              </div>
            )}

            <div className="col-span-2 grid grid-cols-2 gap-x-6 border-t pt-4">
              <div className="space-y-1">
                <Label>Org Units <span className="text-gray-400 font-normal">(one or more)</span></Label>
                <OrgUnitPicker
                  nodes={orgTree}
                  mode="multi"
                  value={editForm.orgUnitIds}
                  onChange={(v) => setEditForm({ ...editForm, orgUnitIds: v as string[] })}
                  className="max-h-48"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    />
                    Account Active
                  </label>
                  {!editUser?.isActive && !editForm.isActive && (
                    <p className="text-xs text-yellow-600 mt-1">(pending activation — check the box and save to activate)</p>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-700">Change Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span></p>
                <div className="space-y-1">
                  <Label>New Password</Label>
                  <Input type="password" autoComplete="new-password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Min. 6 characters" />
                </div>
                <div className="space-y-1">
                  <Label>Confirm Password</Label>
                  <Input type="password" autoComplete="new-password" value={editForm.confirmPassword} onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })} placeholder="Re-enter new password" />
                  {editForm.confirmPassword && !editPasswordsMatch && (
                    <p className="text-xs text-red-500">Passwords do not match.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="col-span-2 space-y-2 border-t pt-4">
              <Label>Signature</Label>
              <p className="text-xs text-gray-500">PNG, JPG, or JPEG only. Used on printed documents where this user's signature is required.</p>
              <div className="flex items-center gap-4">
                {signaturePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signaturePreview} alt="Signature preview" className="h-16 border border-gray-200 rounded bg-white object-contain px-2" />
                ) : (
                  <div className="h-16 w-32 flex items-center justify-center border border-dashed border-gray-300 rounded text-xs text-gray-400">
                    No signature
                  </div>
                )}
                <Input type="file" accept="image/png,image/jpeg" onChange={handleSignatureFileChange} className="max-w-xs" />
                {editUser?.signatureUrl && signaturePreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteSignature}
                    disabled={deletingSignature}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    {deletingSignature ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Delete
                  </Button>
                )}
              </div>
              {signatureError && <p className="text-xs text-red-500">{signatureError}</p>}
            </div>

            {editError && <div className="col-span-2 rounded-md bg-red-50 p-3 text-sm text-red-600">{editError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button
              onClick={handleEdit}
              disabled={
                !editForm.name || !editForm.userName || !editForm.email || editSubmitting ||
                (!!editForm.password && (editForm.password.length < 6 || !editPasswordsMatch)) ||
                (editNeedsDept && !editForm.departmentId)
              }
            >
              {editSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); setError(""); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-2">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ravi Patel" />
            </div>
            <div className="space-y-1">
              <Label>Username *</Label>
              <Input value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} placeholder="e.g. rpatel" />
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ravi@company.com" />
            </div>
            <div className="space-y-1">
              <Label>Password *</Label>
              <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
            </div>
            <div className="space-y-1">
              <Label>Role *</Label>
              <Select value={form.userRole} onValueChange={(v) => setForm({ ...form, userRole: v, departmentId: "", orgUnitIds: [] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {creatableRoles.map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ROLE_HINTS[form.userRole] && (
                <p className="text-xs text-gray-500">{ROLE_HINTS[form.userRole]}</p>
              )}
            </div>

            {needsDept && (
              <div className="space-y-1">
                <Label>Department *</Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="col-span-2 space-y-1 border-t pt-4">
              <Label>Org Units{needsOrgUnit ? " *" : " (optional)"}</Label>
              <OrgUnitPicker
                nodes={orgTree}
                mode="multi"
                value={form.orgUnitIds}
                onChange={(v) => setForm({ ...form, orgUnitIds: v as string[] })}
                className="max-h-48"
              />
            </div>

            {error && <div className="col-span-2 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={handleAdd}
              disabled={
                !form.name || !form.userName || !form.email || !form.password || submitting ||
                (needsDept && !form.departmentId) ||
                (needsOrgUnit && form.orgUnitIds.length === 0)
              }
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
