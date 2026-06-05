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
import { Plus, Search, Loader2, UserCheck } from "lucide-react";
import { formatDate, USER_ROLES } from "@/lib/utils";

interface User {
  id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string;
  branch: { name: string } | null; country: { name: string } | null;
}
interface Branch { id: string; name: string; code: string }
interface Country { id: string; name: string }
interface Department { id: string; name: string }

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  HR: "bg-blue-100 text-blue-700",
  BRANCH_MANAGER: "bg-green-100 text-green-700",
  DIVISIONAL_MANAGER: "bg-yellow-100 text-yellow-700",
  FUNCTIONAL_HEAD: "bg-orange-100 text-orange-700",
  COUNTRY_MANAGER: "bg-red-100 text-red-700",
  CANDIDATE: "bg-gray-100 text-gray-700",
};

const ROLE_HINTS: Record<string, string> = {
  HR: "Assign a country or branch",
  BRANCH_MANAGER: "Assign a branch (required)",
  DIVISIONAL_MANAGER: "Assign a country",
  FUNCTIONAL_HEAD: "Assign a department + country",
  COUNTRY_MANAGER: "Assign a country",
};

export default function UsersPage() {
  const { data: session } = useSession();
  const myRole = (session?.user as { role?: string })?.role || "";

  const [users, setUsers] = useState<User[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", password: "", userRole: "HR",
    branchId: "", countryId: "", departmentId: "",
  });

  const fetchUsers = () => {
    fetch("/api/users").then((r) => r.json()).then((d) => { setUsers(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => {
    fetchUsers();
    fetch("/api/org/countries").then((r) => r.json()).then(setCountries);
    fetch("/api/org/branches").then((r) => r.json()).then(setBranches);
    fetch("/api/org/departments").then((r) => r.json()).then(setDepartments);
  }, []);

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  // Roles HR can create (no ADMIN, no CANDIDATE)
  const creatableRoles = Object.entries(USER_ROLES).filter(([k]) => {
    if (k === "CANDIDATE") return false;
    if (k === "ADMIN" && myRole !== "ADMIN") return false;
    return true;
  });

  const handleAdd = async () => {
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create user.");
      return;
    }
    setShowAdd(false);
    setForm({ name: "", email: "", password: "", userRole: "HR", branchId: "", countryId: "", departmentId: "" });
    fetchUsers();
  };

  const needsDept = form.userRole === "FUNCTIONAL_HEAD";
  const needsBranch = form.userRole === "BRANCH_MANAGER";

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
        {Object.entries(USER_ROLES).filter(([k]) => k !== "CANDIDATE").map(([key, label]) => (
          <div key={key} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${ROLE_COLORS[key]}`}>
            <UserCheck className="h-4 w-4" />
            <span className="text-sm font-medium">{label}</span>
            <span className="font-bold">{users.filter((u) => u.role === key).length}</span>
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
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch / Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm text-gray-500">{u.email}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                        {USER_ROLES[u.role as keyof typeof USER_ROLES] || u.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {u.branch?.name || u.country?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "success" : "secondary"}>
                        {u.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(u.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); setError(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ravi Patel" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ravi@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={form.userRole} onValueChange={(v) => setForm({ ...form, userRole: v, departmentId: "", branchId: "", countryId: "" })}>
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
              <div className="space-y-2">
                <Label>Department *</Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {needsBranch && (
                <div className="space-y-2 col-span-2">
                  <Label>Branch *</Label>
                  <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2 col-span-2">
                <Label>Country{!needsBranch ? " (optional)" : ""}</Label>
                <Select value={form.countryId} onValueChange={(v) => setForm({ ...form, countryId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={handleAdd}
              disabled={
                !form.name || !form.email || !form.password || submitting ||
                (needsDept && !form.departmentId) ||
                (needsBranch && !form.branchId)
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
