"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Trash2 } from "lucide-react";

interface Designation { id: string; title: string; isActive: boolean; department: { name: string } }
interface Department { id: string; name: string }

export default function DesignationsPage() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", departmentId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  const fetchAll = () =>
    Promise.all([
      fetch("/api/org/designations").then((r) => r.json()),
      fetch("/api/org/departments").then((r) => r.json()),
    ]).then(([d, depts]) => { setDesignations(d); setDepartments(depts); setLoading(false); });

  useEffect(() => { fetchAll(); }, []);

  const handleAdd = async () => {
    setSubmitting(true);
    await fetch("/api/org/designations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, requiresPsychometric: false }),
    });
    setSubmitting(false);
    setShowAdd(false);
    setForm({ title: "", departmentId: "" });
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    setDeleteErrors((prev) => ({ ...prev, [id]: "" }));
    const res = await fetch(`/api/org/designations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setDeleteErrors((prev) => ({ ...prev, [id]: data.error || "Delete failed." }));
      return;
    }
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Designations</h2>
          <p className="text-sm text-gray-500 mt-1">{designations.length} designations configured</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Designation</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {designations.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.title}</TableCell>
                    <TableCell>{d.department.name}</TableCell>
                    <TableCell>
                      <Badge variant={d.isActive ? "success" : "secondary"}>
                        {d.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {deleteErrors[d.id] && (
                        <span className="text-xs text-red-500 mr-2">{deleteErrors[d.id]}</span>
                      )}
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        title="Delete designation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Designation</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input placeholder="e.g. Senior Engineer" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Department *</Label>
              <Select onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.title || !form.departmentId || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Designation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
