"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Users, Loader2 } from "lucide-react";
import { CANDIDATE_STAGES, formatDate } from "@/lib/utils";
import { Suspense } from "react";

interface Candidate {
  id: string; firstName: string; lastName: string; email: string; phone: string | null;
  currentStage: string; aiScore: number | null; createdAt: string;
  mrf: {
    id: string; title: string;
    department: { name: string };
    branch: { name: string; state: { name: string } | null; country: { name: string } } | null;
    country: { name: string };
  } | null;
}

interface MRF { id: string; mrfNumber: string; title: string }

function CandidatesContent() {
  const searchParams = useSearchParams();
  const mrfFilter = searchParams.get("mrfId") || "";

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [mrfs, setMrfs] = useState<MRF[]>([]);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", mrfId: mrfFilter });
  const [submitting, setSubmitting] = useState(false);

  const fetchCandidates = () => {
    const url = mrfFilter ? `/api/candidates?mrfId=${mrfFilter}` : "/api/candidates";
    fetch(url).then((r) => r.json()).then((d) => { setCandidates(d); setLoading(false); });
  };

  useEffect(() => {
    fetchCandidates();
    fetch("/api/mrfs").then((r) => r.json()).then(setMrfs);
  }, []);

  const filtered = candidates.filter((c) => {
    const matchesSearch =
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === "ALL" || c.currentStage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const handleAdd = async () => {
    setSubmitting(true);
    await fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    setShowAdd(false);
    setForm({ firstName: "", lastName: "", email: "", phone: "", mrfId: "" });
    fetchCandidates();
  };

  const stageCount = (key: string) => candidates.filter((c) => c.currentStage === key).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Candidates</h2>
          <p className="text-sm text-gray-500 mt-1">{candidates.length} total candidates</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Add Candidate
        </Button>
      </div>

      {/* Stage Pipeline Overview */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {CANDIDATE_STAGES.map((stage) => (
            <button
              key={stage.key}
              onClick={() => setStageFilter(stageFilter === stage.key ? "ALL" : stage.key)}
              className={`flex flex-col items-center rounded-lg border px-4 py-3 text-center transition-colors min-w-[110px]
                ${stageFilter === stage.key ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
            >
              <span className={`text-xl font-bold ${stageFilter === stage.key ? "text-blue-600" : "text-gray-900"}`}>
                {stageCount(stage.key)}
              </span>
              <span className="text-xs text-gray-500 mt-1 leading-tight">{stage.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Stages</SelectItem>
                {CANDIDATE_STAGES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p>No candidates found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>MRF / Position</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>AI Score</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const stage = CANDIDATE_STAGES.find((s) => s.key === c.currentStage);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
                      <TableCell className="text-sm text-gray-500">{c.email}</TableCell>
                      <TableCell>
                        {c.mrf ? (
                          <>
                            <p className="text-sm font-medium">{c.mrf.title}</p>
                            <p className="text-xs text-gray-500">
                              {c.mrf.department.name}
                              {c.mrf.branch
                                ? ` · ${c.mrf.branch.name}${c.mrf.branch.state ? `, ${c.mrf.branch.state.name}` : ""}`
                                : ""}
                              {" · "}{c.mrf.country.name}
                            </p>
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{stage?.label || c.currentStage}</Badge>
                      </TableCell>
                      <TableCell>
                        {c.aiScore != null ? (
                          <span className={`font-medium text-sm ${c.aiScore >= 70 ? "text-green-600" : "text-orange-600"}`}>
                            {c.aiScore.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{formatDate(c.createdAt)}</TableCell>
                      <TableCell>
                        <Link href={`/dashboard/candidates/${c.id}`} className="text-blue-600 hover:underline text-sm">
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Candidate Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Candidate</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Link to MRF</Label>
              <Select value={form.mrfId} onValueChange={(v) => setForm({ ...form, mrfId: v })}>
                <SelectTrigger><SelectValue placeholder="Select MRF (optional)" /></SelectTrigger>
                <SelectContent>
                  {mrfs.filter((m) => m).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.mrfNumber} – {m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.firstName || !form.email || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Candidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CandidatesPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>}>
      <CandidatesContent />
    </Suspense>
  );
}
