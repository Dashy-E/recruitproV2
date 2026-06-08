"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, UserCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Branch { id: string; name: string; code: string }

interface Employee {
  id: string;
  employeeCode: string;
  joiningDate: string;
  department: string | null;
  designation: string | null;
  ctc: number | null;
  reportingTo: string | null;
  isActive: boolean;
  candidate: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    mrf: { department: { name: string } } | null;
  };
  branch: { name: string } | null;
}

interface JoinedCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  currentStage: string;
  employee: null | { id: string };
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [joinedCandidates, setJoinedCandidates] = useState<JoinedCandidate[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState({
    candidateId: "",
    joiningDate: "",
    department: "",
    designation: "",
    ctc: "",
    reportingTo: "",
    branchId: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchEmployees = () => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((d) => { setEmployees(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => {
    fetchEmployees();
    fetch("/api/org/branches").then((r) => r.json()).then((d) => setBranches(Array.isArray(d) ? d : []));
  }, []);

  const openAddDialog = async () => {
    const res = await fetch("/api/candidates?stage=JOINED");
    const all: JoinedCandidate[] = await res.json();
    const joined = (Array.isArray(all) ? all : []).filter(
      (c) => c.currentStage === "JOINED" && !c.employee
    );
    setJoinedCandidates(joined);
    setForm({ candidateId: "", joiningDate: "", department: "", designation: "", ctc: "", reportingTo: "", branchId: "" });
    setShowAdd(true);
  };

  const handleAdd = async () => {
    setSubmitting(true);
    await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ctc: form.ctc ? parseFloat(form.ctc) : null,
        branchId: form.branchId || null,
      }),
    });
    setSubmitting(false);
    setShowAdd(false);
    fetchEmployees();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employees</h2>
          <p className="text-sm text-gray-500 mt-1">{employees.length} employee records</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-1" /> Add Employee
        </Button>
      </div>

      <Card>
        <CardHeader />
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>
          ) : employees.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <UserCheck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p>No employees yet. Convert a joined candidate to an employee record.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead>CTC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono text-sm font-medium">{emp.employeeCode}</TableCell>
                    <TableCell>
                      <p className="font-medium">{emp.candidate.firstName} {emp.candidate.lastName}</p>
                      <p className="text-xs text-gray-500">{emp.candidate.email}</p>
                    </TableCell>
                    <TableCell>{emp.department || "—"}</TableCell>
                    <TableCell>{emp.designation || "—"}</TableCell>
                    <TableCell>{emp.branch?.name || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">{formatDate(emp.joiningDate)}</TableCell>
                    <TableCell className="text-sm">
                      {emp.ctc != null ? `₹${emp.ctc.toLocaleString("en-IN")}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Employee Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Convert Candidate to Employee</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Candidate (Joined) *</Label>
              <Select value={form.candidateId} onValueChange={(v) => setForm({ ...form, candidateId: v })}>
                <SelectTrigger><SelectValue placeholder="Select candidate" /></SelectTrigger>
                <SelectContent>
                  {joinedCandidates.length === 0 ? (
                    <SelectItem value="__none" disabled>No joined candidates without employee record</SelectItem>
                  ) : (
                    joinedCandidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.email}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Joining Date *</Label>
              <Input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Operations" />
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Engineer" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>CTC (₹)</Label>
                <Input type="number" value={form.ctc} onChange={(e) => setForm({ ...form, ctc: e.target.value })} placeholder="e.g. 500000" />
              </div>
              <div className="space-y-2">
                <Label>Reporting To</Label>
                <Input value={form.reportingTo} onChange={(e) => setForm({ ...form, reportingTo: e.target.value })} placeholder="Manager name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                <SelectTrigger><SelectValue placeholder="Select branch (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.candidateId || !form.joiningDate || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Create Employee Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
