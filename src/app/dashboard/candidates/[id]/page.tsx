"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { CANDIDATE_STAGES, formatDate } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface CandidateDetail {
  id: string; firstName: string; lastName: string; email: string; phone: string | null;
  currentStage: string; aiScore: number | null; aiScoreNotes: string | null; resumeUrl: string | null;
  createdAt: string; updatedAt: string;
  mrf: { id: string; title: string; department: { name: string }; branch: { name: string }; designation: { requiresPsychometric: boolean } | null } | null;
  stageHistory: { id: string; fromStage: string | null; toStage: string; notes: string | null; changedAt: string }[];
  documents: { id: string; name: string; documentType: string; createdAt: string }[];
}

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageDialog, setStageDialog] = useState(false);
  const [toStage, setToStage] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canManage = ["ADMIN", "HR"].includes(role);

  const fetchCandidate = () => {
    fetch(`/api/candidates/${id}`)
      .then((r) => r.json())
      .then((d) => { setCandidate(d); setLoading(false); });
  };

  useEffect(() => { fetchCandidate(); }, [id]);

  const handleStageChange = async () => {
    setSubmitting(true);
    const res = await fetch(`/api/candidates/${id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStage, notes }),
    });
    setSubmitting(false);
    if (res.ok) {
      setStageDialog(false);
      setToStage(""); setNotes("");
      fetchCandidate();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to update stage.");
    }
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>;
  if (!candidate) return <div className="py-20 text-center text-gray-500">Candidate not found.</div>;

  const currentStageInfo = CANDIDATE_STAGES.find((s) => s.key === candidate.currentStage);
  const currentIdx = CANDIDATE_STAGES.findIndex((s) => s.key === candidate.currentStage);
  const requiresPsychometric = candidate.mrf?.designation?.requiresPsychometric ?? true;

  const nextStages = CANDIDATE_STAGES.filter((s, idx) => {
    if (idx <= currentIdx) return false;
    if (s.key === "PSYCHOMETRIC_TEST" && !requiresPsychometric) return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/candidates">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{candidate.firstName} {candidate.lastName}</h2>
          <p className="text-sm text-gray-500">{candidate.email} {candidate.phone ? `· ${candidate.phone}` : ""}</p>
        </div>
        {canManage && candidate.currentStage !== "ONBOARDED" && (
          <Button onClick={() => setStageDialog(true)}>
            <ChevronRight className="h-4 w-4" /> Advance Stage
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Overview */}
        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Current Stage</span>
              <Badge variant="default">{currentStageInfo?.label || candidate.currentStage}</Badge>
            </div>
            {candidate.aiScore != null && (
              <div className="flex justify-between">
                <span className="text-gray-500">AI Score</span>
                <span className={`font-bold ${candidate.aiScore >= 70 ? "text-green-600" : "text-orange-600"}`}>
                  {candidate.aiScore.toFixed(1)}%
                </span>
              </div>
            )}
            {candidate.aiScoreNotes && (
              <div>
                <p className="text-gray-500 mb-1">AI Notes</p>
                <p className="text-gray-700 text-xs">{candidate.aiScoreNotes}</p>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Applied</span>
              <span>{formatDate(candidate.createdAt)}</span>
            </div>
            {candidate.mrf && (
              <>
                <div className="pt-2 border-t">
                  <p className="text-gray-500 mb-1">Linked MRF</p>
                  <Link href={`/dashboard/mrfs/${candidate.mrf.id}`} className="text-blue-600 hover:underline font-medium">
                    {candidate.mrf.title}
                  </Link>
                  <p className="text-xs text-gray-500">{candidate.mrf.department.name} · {candidate.mrf.branch.name}</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Psychometric Required</span>
                  <span className={requiresPsychometric ? "text-orange-600 font-medium" : "text-gray-600"}>
                    {requiresPsychometric ? "Yes" : "No"}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stage Progress */}
        <Card>
          <CardHeader><CardTitle>Recruitment Pipeline</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {CANDIDATE_STAGES.map((stage, idx) => {
                if (stage.key === "PSYCHOMETRIC_TEST" && !requiresPsychometric) {
                  return (
                    <div key={stage.key} className="flex items-center gap-3 opacity-40">
                      <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">—</div>
                      <span className="text-sm text-gray-400 line-through">{stage.label}</span>
                      <span className="ml-auto text-xs text-gray-400">Skipped</span>
                    </div>
                  );
                }
                const status = idx < currentIdx ? "done" : idx === currentIdx ? "current" : "pending";
                return (
                  <div key={stage.key} className="flex items-center gap-3">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium
                      ${status === "done" ? "bg-green-100 text-green-700" :
                        status === "current" ? "bg-blue-600 text-white" :
                        "bg-gray-100 text-gray-400"}`}>
                      {status === "done" ? "✓" : stage.step}
                    </div>
                    <span className={`text-sm ${status === "current" ? "font-semibold text-blue-700" : status === "done" ? "text-gray-700" : "text-gray-400"}`}>
                      {stage.label}
                    </span>
                    {status === "current" && (
                      <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Now</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage History */}
      <Card>
        <CardHeader><CardTitle>Stage History</CardTitle></CardHeader>
        <CardContent>
          {candidate.stageHistory.length === 0 ? (
            <p className="text-sm text-gray-500">No history yet.</p>
          ) : (
            <div className="space-y-3">
              {candidate.stageHistory.map((h) => {
                const toS = CANDIDATE_STAGES.find((s) => s.key === h.toStage);
                return (
                  <div key={h.id} className="flex items-start gap-3 border-l-2 border-gray-200 pl-4 py-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {h.fromStage && <span className="text-xs text-gray-400">{CANDIDATE_STAGES.find((s) => s.key === h.fromStage)?.label}</span>}
                        {h.fromStage && <ChevronRight className="h-3 w-3 text-gray-400" />}
                        <span className="text-sm font-medium text-gray-900">{toS?.label || h.toStage}</span>
                      </div>
                      {h.notes && <p className="text-xs text-gray-500 mt-0.5 italic">"{h.notes}"</p>}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{formatDate(h.changedAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advance Stage Dialog */}
      <Dialog open={stageDialog} onOpenChange={setStageDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Advance Candidate Stage</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-700">
              Candidates can only move forward. This action is final.
            </div>
            <div className="space-y-2">
              <Label>Move to Stage *</Label>
              <Select onValueChange={setToStage}>
                <SelectTrigger><SelectValue placeholder="Select next stage" /></SelectTrigger>
                <SelectContent>
                  {nextStages.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Interview result, test score, reason..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialog(false)}>Cancel</Button>
            <Button onClick={handleStageChange} disabled={!toStage || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Advance Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
