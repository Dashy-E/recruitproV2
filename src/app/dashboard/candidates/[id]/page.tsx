"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronRight, Loader2, Upload, FileText, CheckCircle, XCircle, Clock, Pencil, Trash2 } from "lucide-react";
import { CANDIDATE_STAGES, formatDate } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface Document {
  id: string; name: string; documentType: string; fileUrl: string;
  approvalStatus: string; approvalNotes: string | null; createdAt: string;
  uploadedBy: { name: string };
}

interface CandidateDetail {
  id: string; firstName: string; lastName: string; email: string; phone: string | null;
  currentStage: string; aiScore: number | null; aiScoreNotes: string | null; resumeUrl: string | null;
  createdAt: string; updatedAt: string;
  mrf: { id: string; title: string; department: { name: string }; branch: { name: string } | null; designation: { requiresPsychometric: boolean } | null } | null;
  stageHistory: { id: string; fromStage: string | null; toStage: string; notes: string | null; changedAt: string }[];
  documents: { id: string; name: string; documentType: string; createdAt: string }[];
}

interface MRFOption { id: string; mrfNumber: string; title: string; }

interface EditForm {
  firstName: string; lastName: string; email: string; phone: string;
  aiScore: string; aiScoreNotes: string; resumeUrl: string; mrfId: string;
  password: string;
}

const APPROVAL_BADGE: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  PENDING: { label: "Pending", icon: Clock, cls: "text-yellow-600 bg-yellow-50" },
  APPROVED: { label: "Approved", icon: CheckCircle, cls: "text-green-600 bg-green-50" },
  REJECTED: { label: "Rejected", icon: XCircle, cls: "text-red-600 bg-red-50" },
};

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageDialog, setStageDialog] = useState(false);
  const [toStage, setToStage] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("RECRUITMENT");
  const fileRef = useRef<HTMLInputElement>(null);
  const [mrfs, setMrfs] = useState<MRFOption[]>([]);
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ firstName: "", lastName: "", email: "", phone: "", aiScore: "", aiScoreNotes: "", resumeUrl: "", mrfId: "", password: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const canManage = ["ADMIN", "HR"].includes(role);

  const fetchCandidate = () => {
    fetch(`/api/candidates/${id}`)
      .then((r) => r.json())
      .then((d) => { setCandidate(d); setLoading(false); });
  };

  const fetchDocs = () => {
    fetch(`/api/documents?candidateId=${id}`)
      .then((r) => r.json())
      .then((d) => setDocuments(Array.isArray(d) ? d : []));
  };

  useEffect(() => {
    fetchCandidate();
    fetchDocs();
    fetch("/api/mrfs").then((r) => r.json()).then((d) => setMrfs(Array.isArray(d) ? d : []));
  }, [id]);

  const openEdit = () => {
    if (!candidate) return;
    setEditForm({
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone ?? "",
      aiScore: candidate.aiScore != null ? String(candidate.aiScore) : "",
      aiScoreNotes: candidate.aiScoreNotes ?? "",
      resumeUrl: candidate.resumeUrl ?? "",
      mrfId: candidate.mrf?.id ?? "none",
      password: "",
    });
    setEditDialog(true);
  };

  const handleEdit = async () => {
    setEditSubmitting(true);
    const payload: Record<string, unknown> = {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      email: editForm.email,
      phone: editForm.phone || null,
      aiScoreNotes: editForm.aiScoreNotes || null,
      resumeUrl: editForm.resumeUrl || null,
      mrfId: editForm.mrfId === "none" ? null : editForm.mrfId,
    };
    if (editForm.aiScore !== "") {
      const parsed = parseFloat(editForm.aiScore);
      payload.aiScore = isNaN(parsed) ? null : parsed;
    } else {
      payload.aiScore = null;
    }
    if (editForm.password) payload.newPassword = editForm.password;
    await fetch(`/api/candidates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setEditSubmitting(false);
    setEditDialog(false);
    fetchCandidate();
  };

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

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("documentType", docType);
    fd.append("candidateId", id);
    await fetch("/api/documents", { method: "POST", body: fd });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    fetchDocs();
  };

  const handleApproval = async (docId: string, approvalStatus: string) => {
    await fetch(`/api/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus }),
    });
    fetchDocs();
  };

  const handleDeleteDoc = async (docId: string, docName: string) => {
    if (!confirm(`Delete "${docName}"? This cannot be undone.`)) return;
    await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    fetchDocs();
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
        {canManage && (
          <Button variant="outline" onClick={openEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
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
                  <p className="text-xs text-gray-500">{candidate.mrf.department.name}{candidate.mrf.branch ? ` · ${candidate.mrf.branch.name}` : ""}</p>
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

      {/* Documents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Documents</CardTitle>
            {canManage && (
              <div className="flex items-center gap-2">
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["IDENTIFICATION", "RECRUITMENT", "ONBOARDING", "OTHER"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Upload
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-gray-500">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => {
                const info = APPROVAL_BADGE[doc.approvalStatus] || APPROVAL_BADGE.PENDING;
                const Icon = info.icon;
                return (
                  <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline truncate block">
                        {doc.name}
                      </a>
                      <p className="text-xs text-gray-400">{doc.documentType} · by {doc.uploadedBy.name} · {formatDate(doc.createdAt)}</p>
                      {doc.approvalNotes && <p className="text-xs text-gray-500 italic mt-0.5">"{doc.approvalNotes}"</p>}
                    </div>
                    <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${info.cls}`}>
                      <Icon className="h-3 w-3" />
                      {info.label}
                    </div>
                    {canManage && doc.approvalStatus === "PENDING" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-green-600 hover:text-green-700 text-xs px-2"
                          onClick={() => handleApproval(doc.id, "APPROVED")}>Approve</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-red-600 hover:text-red-700 text-xs px-2"
                          onClick={() => handleApproval(doc.id, "REJECTED")}>Reject</Button>
                      </div>
                    )}
                    {canManage && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                        onClick={() => handleDeleteDoc(doc.id, doc.name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Candidate Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Edit Candidate Details</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Name *</Label>
                <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label>Password <span className="text-gray-400 font-normal text-xs">(leave blank to keep current)</span></Label>
              <Input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Set new portal password" />
            </div>
            <div className="space-y-1">
              <Label>Linked MRF</Label>
              <Select value={editForm.mrfId} onValueChange={(v) => setEditForm({ ...editForm, mrfId: v })}>
                <SelectTrigger><SelectValue placeholder="Select MRF" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None (unlink) —</SelectItem>
                  {mrfs.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.mrfNumber} – {m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>AI Score (%)</Label>
              <Input type="number" min="0" max="100" step="0.1" value={editForm.aiScore}
                onChange={(e) => setEditForm({ ...editForm, aiScore: e.target.value })} placeholder="e.g. 82.5" />
            </div>
            <div className="space-y-1">
              <Label>AI Score Notes</Label>
              <Textarea rows={2} value={editForm.aiScoreNotes}
                onChange={(e) => setEditForm({ ...editForm, aiScoreNotes: e.target.value })} placeholder="Optional notes from AI screening" />
            </div>
            <div className="space-y-1">
              <Label>Resume URL</Label>
              <Input value={editForm.resumeUrl} onChange={(e) => setEditForm({ ...editForm, resumeUrl: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t">
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!editForm.firstName || !editForm.email || editSubmitting}>
              {editSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
