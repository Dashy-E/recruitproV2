"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";

interface Designation { id: string; title: string; requiresPsychometric: boolean; isActive: boolean; department: { name: string } }
interface Department { id: string; name: string }

export default function DesignationsPage() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", departmentId: "", requiresPsychometric: false });
  const [submitting, setSubmitting] = useState(false);

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
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    setShowAdd(false);
    setForm({ title: "", departmentId: "", requiresPsychometric: false });
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Designations</h2>
          <p className="text-sm text-gray-500 mt-1">
            {designations.filter((d) => d.requiresPsychometric).length} require psychometric testing
          </p>
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
                  <TableHead>Psychometric Test</TableHead>
                  <TableHead>Chemistry Test</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {designations.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.title}</TableCell>
                    <TableCell>{d.department.name}</TableCell>
                    <TableCell>
                      <Badge variant={d.requiresPsychometric ? "warning" : "secondary"}>
                        {d.requiresPsychometric ? "Required" : "Not Required"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">Mandatory (all)</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={d.isActive ? "success" : "secondary"}>
                        {d.isActive ? "Active" : "Inactive"}
                      </Badge>
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
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="psycho"
                checked={form.requiresPsychometric}
                onChange={(e) => setForm({ ...form, requiresPsychometric: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="psycho">Requires Psychometric Test</Label>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
              Chemistry Test is mandatory for all designations as per current policy.
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
