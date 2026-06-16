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
import { Plus, Search, Users, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { CANDIDATE_STAGES, formatDate } from "@/lib/utils";
import { Suspense } from "react";

interface Candidate {
  id: string; firstName: string; lastName: string; email: string; phone: string | null;
  currentStage: string; candidateStatus: string; statusNote: string | null;
  aiScore: number | null; createdAt: string; interviewDate: string | null;
  mrf: {
    id: string; title: string;
    department: { name: string };
    branch: { name: string; state: { name: string } | null; country: { name: string } } | null;
    country: { name: string };
  } | null;
}

interface MRF { id: string; mrfNumber: string; title: string }

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "",
  REJECTED: "bg-red-100 text-red-700",
  ON_HOLD: "bg-yellow-100 text-yellow-700",
};

function isoWeek(d: Date): string {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const diff = (d.getTime() - jan4.getTime()) / 86400000;
  const week = Math.ceil((diff + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function groupByDay(candidates: Candidate[]) {
  const groups: Record<string, Candidate[]> = {};
  for (const c of candidates) {
    const d = new Date(c.createdAt);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    const groupKey = `${key}|${label}`;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(c);
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

function groupByWeek(candidates: Candidate[]) {
  const groups: Record<string, Candidate[]> = {};
  for (const c of candidates) {
    const d = new Date(c.createdAt);
    const week = isoWeek(d);
    // Find Monday of this week
    const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const monday = new Date(d); monday.setDate(d.getDate() - dayOfWeek);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const label = `${monday.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – ${sunday.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
    const groupKey = `${week}|${label}`;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(c);
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

function groupByMonth(candidates: Candidate[]) {
  const groups: Record<string, Candidate[]> = {};
  for (const c of candidates) {
    const d = new Date(c.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const groupKey = `${key}|${label}`;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(c);
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

function groupByInterviewDate(candidates: Candidate[]) {
  const groups: Record<string, Candidate[]> = {};
  for (const c of candidates) {
    if (!c.interviewDate) {
      if (!groups["__unscheduled"]) groups["__unscheduled"] = [];
      groups["__unscheduled"].push(c);
    } else {
      const d = new Date(c.interviewDate);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      const groupKey = `${key}|Interview – ${label}`;
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(c);
    }
  }
  return Object.entries(groups).sort((a, b) => {
    if (a[0] === "__unscheduled") return 1;
    if (b[0] === "__unscheduled") return -1;
    return a[0].localeCompare(b[0]);
  });
}

function CandidateRow({ c }: { c: Candidate }) {
  const stage = CANDIDATE_STAGES.find((s) => s.key === c.currentStage);
  const statusCls = STATUS_BADGE[c.candidateStatus] || STATUS_BADGE.ACTIVE;
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
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="default">{stage?.label || c.currentStage}</Badge>
          {c.candidateStatus !== "ACTIVE" && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCls}`}>
              {c.candidateStatus === "ON_HOLD" ? "On Hold" : c.candidateStatus}
            </span>
          )}
        </div>
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
}

function CandidateTable({ candidates }: { candidates: Candidate[] }) {
  if (candidates.length === 0) return null;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>MRF / Position</TableHead>
          <TableHead>Stage / Status</TableHead>
          <TableHead>AI Score</TableHead>
          <TableHead>Added</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {candidates.map((c) => <CandidateRow key={c.id} c={c} />)}
      </TableBody>
    </Table>
  );
}

function CollapsibleSection({ title, candidates, defaultOpen = false }: { title: string; candidates: Candidate[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium"
      >
        <span>{title} ({candidates.length})</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <CandidateTable candidates={candidates} />}
    </div>
  );
}

function CandidatesContent() {
  const searchParams = useSearchParams();
  const mrfFilter = searchParams.get("mrfId") || "";

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [mrfs, setMrfs] = useState<MRF[]>([]);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"list" | "daily" | "weekly" | "monthly">("list");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", mrfId: mrfFilter });
  const [submitting, setSubmitting] = useState(false);
  const [newCandidatePassword, setNewCandidatePassword] = useState("");

  const fetchCandidates = () => {
    const url = mrfFilter ? `/api/candidates?mrfId=${mrfFilter}` : "/api/candidates";
    fetch(url).then((r) => r.json()).then((d) => { setCandidates(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => {
    fetchCandidates();
    fetch("/api/mrfs").then((r) => r.json()).then(setMrfs);
  }, []);

  // Separate active/rejected/on-hold
  const activeCandidates = candidates.filter((c) => c.candidateStatus === "ACTIVE");
  const rejectedCandidates = candidates.filter((c) => c.candidateStatus === "REJECTED");
  const onHoldCandidates = candidates.filter((c) => c.candidateStatus === "ON_HOLD");

  const basePool = statusFilter === "REJECTED" ? rejectedCandidates
    : statusFilter === "ON_HOLD" ? onHoldCandidates
    : activeCandidates;

  const filtered = basePool.filter((c) => {
    const matchesSearch =
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === "ALL" || c.currentStage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const handleAdd = async () => {
    setSubmitting(true);
    const res = await fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      if (data.tempPassword) setNewCandidatePassword(data.tempPassword);
    }
    setShowAdd(false);
    setForm({ firstName: "", lastName: "", email: "", phone: "", mrfId: "" });
    fetchCandidates();
  };

  const stageCount = (key: string) => activeCandidates.filter((c) => c.currentStage === key).length;

  const INTERVIEW_STAGES = new Set(["INTERVIEW_1", "INTERVIEW_2", "INTERVIEW_3"]);
  const interviewedFiltered = filtered.filter((c) => INTERVIEW_STAGES.has(c.currentStage));
  const isInterviewedView = INTERVIEW_STAGES.has(stageFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Candidates</h2>
          <p className="text-sm text-gray-500 mt-1">{candidates.length} total candidates</p>
        </div>
        <div className="flex items-center gap-2">
          {(["list", "daily", "weekly", "monthly"] as const).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Button>
          ))}
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Add Candidate
          </Button>
        </div>
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

      {/* Status filter tabs */}
      <div className="flex items-center gap-2">
        {[
          { key: "ALL", label: `Active (${activeCandidates.length})`, cls: "bg-blue-600 text-white" },
          { key: "REJECTED", label: `Rejected (${rejectedCandidates.length})`, cls: "bg-red-100 text-red-700" },
          { key: "ON_HOLD", label: `On Hold (${onHoldCandidates.length})`, cls: "bg-yellow-100 text-yellow-700" },
        ].map(({ key, label, cls }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors
              ${statusFilter === key ? cls : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {label}
          </button>
        ))}
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
          ) : viewMode === "daily" ? (
            <div className="p-4 space-y-4">
              {groupByDay(filtered).map(([groupKey, groupCandidates]) => (
                <CollapsibleSection key={groupKey} title={groupKey.split("|")[1]} candidates={groupCandidates} defaultOpen />
              ))}
            </div>
          ) : viewMode === "weekly" ? (
            <div className="p-4 space-y-4">
              {groupByWeek(filtered).map(([groupKey, groupCandidates]) => (
                <CollapsibleSection key={groupKey} title={groupKey.split("|")[1]} candidates={groupCandidates} defaultOpen />
              ))}
            </div>
          ) : viewMode === "monthly" ? (
            <div className="p-4 space-y-4">
              {groupByMonth(filtered).map(([groupKey, groupCandidates]) => (
                <CollapsibleSection key={groupKey} title={groupKey.split("|")[1]} candidates={groupCandidates} defaultOpen />
              ))}
            </div>
          ) : isInterviewedView ? (
            <div className="p-4 space-y-4">
              {groupByInterviewDate(interviewedFiltered).map(([groupKey, groupCandidates]) => {
                const label = groupKey === "__unscheduled" ? "Unscheduled" : groupKey.split("|")[1];
                return (
                  <CollapsibleSection key={groupKey} title={label} candidates={groupCandidates} defaultOpen />
                );
              })}
              {filtered.filter((c) => !INTERVIEW_STAGES.has(c.currentStage)).length > 0 && (
                <CandidateTable candidates={filtered.filter((c) => !INTERVIEW_STAGES.has(c.currentStage))} />
              )}
            </div>
          ) : (
            <CandidateTable candidates={filtered} />
          )}
        </CardContent>
      </Card>

      {/* Rejected/On Hold sections */}
      {statusFilter === "ALL" && (rejectedCandidates.length > 0 || onHoldCandidates.length > 0) && (
        <div className="space-y-3">
          {rejectedCandidates.length > 0 && (
            <CollapsibleSection title="Rejected Candidates" candidates={rejectedCandidates} />
          )}
          {onHoldCandidates.length > 0 && (
            <CollapsibleSection title="On Hold Candidates" candidates={onHoldCandidates} />
          )}
        </div>
      )}

      {/* Temp Password Dialog — shown after creating a new candidate */}
      <Dialog open={!!newCandidatePassword} onOpenChange={(o) => !o && setNewCandidatePassword("")}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Candidate Account Created</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">The candidate can log in with their email and this temporary password:</p>
            <div className="rounded-md bg-gray-900 px-4 py-3 font-mono text-lg text-green-400 tracking-widest text-center">
              {newCandidatePassword}
            </div>
            <p className="text-xs text-gray-400">Share this with the candidate. They should change it after first login via the Edit Candidate dialog.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewCandidatePassword("")}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
