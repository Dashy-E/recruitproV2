"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, Building2 } from "lucide-react";

interface Department {
  id: string; name: string; isActive: boolean;
  designations: { id: string; title: string; requiresPsychometric: boolean }[];
  _count: { mrfs: number };
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchDepts = () =>
    fetch("/api/org/departments").then((r) => r.json()).then((d) => { setDepartments(d); setLoading(false); });

  useEffect(() => { fetchDepts(); }, []);

  const handleAdd = async () => {
    setSubmitting(true);
    await fetch("/api/org/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSubmitting(false);
    setShowAdd(false);
    setName("");
    fetchDepts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Departments</h2>
          <p className="text-sm text-gray-500 mt-1">{departments.length} departments configured</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Department</Button>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <Card key={dept.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-blue-100 p-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{dept._count.mrfs} MRFs</p>
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-400 mb-1">DESIGNATIONS ({dept.designations.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {dept.designations.slice(0, 4).map((d) => (
                          <span key={d.id} className={`rounded-full px-2 py-0.5 text-xs
                            ${d.requiresPsychometric ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                            {d.title}
                          </span>
                        ))}
                        {dept.designations.length > 4 && (
                          <span className="rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-500">
                            +{dept.designations.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Department</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Department Name *</Label>
              <Input placeholder="e.g. Operations" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!name || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
