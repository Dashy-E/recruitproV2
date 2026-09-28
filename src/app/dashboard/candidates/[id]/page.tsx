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
import { toast } from "@/hooks/use-toast";
import { OfferLetterPdfPreview } from "@/components/offer-letter-pdf-preview";

interface Document {
  id: string; name: string; documentType: string; fileUrl: string;
  approvalStatus: string; approvalNotes: string | null; createdAt: string;
  uploadedBy: { name: string };
}

interface CandidateDetail {
  id: string; firstName: string; lastName: string; email: string; phone: string | null;
  currentStage: string; aiScore: number | null; aiScoreNotes: string | null; resumeUrl: string | null;
  designation: string | null; grade: string | null; location: string | null;
  dateOfJoining: string | null; address: string | null;
  refNo: string | null; recruitmentEntity: string | null;
  isFresher: boolean;
  createdAt: string; updatedAt: string;
  mrf: { id: string; title: string; department: { name: string }; orgUnit: { name: string; path: string } | null; designation: { requiresPsychometric: boolean } | null } | null;
  stageHistory: { id: string; fromStage: string | null; toStage: string; notes: string | null; changedAt: string }[];
  documents: { id: string; name: string; documentType: string; createdAt: string }[];
}

interface MRFOption { id: string; referenceNumber: string; mrfNumber: string | null; title: string; }

interface EditForm {
  firstName: string; lastName: string; email: string; phone: string;
  mrfId: string;
  designation: string; grade: string; location: string; dateOfJoining: string; address: string;
  refNo: string; recruitmentEntity: string;
  isFresher: boolean;
}

const RECRUITMENT_ENTITIES = [
  "MSK Private Limited",
  "Primawave Software Private Limited",
  "Gemini Sampling Solutions Private Limited",
];

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
  const [workflowStages, setWorkflowStages] = useState<{ id: string; key: string; label: string; stepOrder: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("RECRUITMENT");
  const fileRef = useRef<HTMLInputElement>(null);
  const aadharRef = useRef<HTMLInputElement>(null);
  const passportRef = useRef<HTMLInputElement>(null);
  const [mrfs, setMrfs] = useState<MRFOption[]>([]);
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ firstName: "", lastName: "", email: "", phone: "", mrfId: "", designation: "", grade: "", location: "", dateOfJoining: "", address: "", refNo: "", recruitmentEntity: "", isFresher: false });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [deletingResume, setDeletingResume] = useState(false);
  const [addressSourceType, setAddressSourceType] = useState("AADHAAR");
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [mrfQuery, setMrfQuery] = useState("");
  const [showMrfDropdown, setShowMrfDropdown] = useState(false);
  const [offerLetterPreviewOpen, setOfferLetterPreviewOpen] = useState(false);

  const canManage = ["ADMIN", "HR"].includes(role);

  const fetchCandidate = () => {
    return fetch(`/api/candidates/${id}`)
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
    fetch("/api/workflow-stages").then((r) => r.json()).then((d) => setWorkflowStages(Array.isArray(d) ? d : []));
  }, [id]);

  const openEdit = () => {
    if (!candidate) return;
    setEditForm({
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone ?? "",
      mrfId: candidate.mrf?.id ?? "none",
      designation: candidate.designation ?? "",
      grade: candidate.grade ?? "",
      location: candidate.location ?? "",
      dateOfJoining: candidate.dateOfJoining ? candidate.dateOfJoining.slice(0, 10) : "",
      address: candidate.address ?? "",
      refNo: candidate.refNo ?? "",
      recruitmentEntity: candidate.recruitmentEntity ?? "",
      isFresher: candidate.isFresher,
    });
    const linkedMrf = candidate.mrf ? mrfs.find((m) => m.id === candidate.mrf!.id) : null;
    setMrfQuery(linkedMrf ? `${linkedMrf.mrfNumber || linkedMrf.referenceNumber} – ${linkedMrf.title}` : "");
    setShowMrfDropdown(false);
    setResumeFile(null);
    setEditDialog(true);
  };

  const handleDeleteResume = async () => {
    setDeletingResume(true);
    const res = await fetch(`/api/candidates/${id}/resume`, { method: "DELETE" });
    setDeletingResume(false);
    if (res.ok) {
      fetchCandidate();
      toast({ variant: "success", title: "Resume deleted" });
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ variant: "destructive", title: "Failed to delete resume", description: data.error });
    }
  };

  const handleFetchAddress = async () => {
    setFetchingAddress(true);
    const res = await fetch(`/api/candidates/${id}/document-address?type=${addressSourceType}`);
    const data = await res.json().catch(() => ({}));
    setFetchingAddress(false);
    if (res.ok) {
      setEditForm((prev) => ({ ...prev, address: data.address }));
      toast({ variant: "success", title: "Address fetched" });
    } else {
      toast({ variant: "destructive", title: "Could not fetch address", description: data.error });
    }
  };

  // Shared by both the plain Save button and "Generate offer letter" — the
  // latter saves first, then opens the PDF preview on top of the same data.
  const saveCandidateEdits = async () => {
    const payload: Record<string, unknown> = {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      email: editForm.email,
      phone: editForm.phone || null,
      mrfId: editForm.mrfId === "none" ? null : editForm.mrfId,
      designation: editForm.designation || null,
      grade: editForm.grade || null,
      location: editForm.location || null,
      dateOfJoining: editForm.dateOfJoining || null,
      address: editForm.address || null,
      refNo: editForm.refNo || null,
      recruitmentEntity: editForm.recruitmentEntity || null,
      isFresher: editForm.isFresher,
    };
    // Resume upload/delete are handled by their own endpoints, independent
    // of this general profile PATCH — upload here only if a new file was
    // picked (the resume section shows View+Delete once one exists, so
    // resumeFile is only ever set when the candidate has none on file yet).
    if (resumeFile) {
      const fd = new FormData();
      fd.append("file", resumeFile);
      const uploadRes = await fetch(`/api/candidates/${id}/resume`, { method: "POST", body: fd });
      if (!uploadRes.ok) {
        const uploadData = await uploadRes.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Resume upload failed", description: uploadData.error });
      }
    }
    await fetch(`/api/candidates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setResumeFile(null);
    // Awaited so callers (e.g. "Generate offer letter") can rely on
    // `candidate` state actually reflecting what was just saved before
    // acting on it — it previously fired-and-forgot here, so the PDF
    // preview could open against stale data saved a moment too late.
    await fetchCandidate();
  };

  const handleEdit = async () => {
    setEditSubmitting(true);
    await saveCandidateEdits();
    setEditSubmitting(false);
    setEditDialog(false);
  };

  const handleGenerateOfferLetter = async () => {
    setEditSubmitting(true);
    await saveCandidateEdits();
    setEditSubmitting(false);
    setEditDialog(false);
    setOfferLetterPreviewOpen(true);
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

  // Aadhar/Passport can each have several pages/sides — multi-file, uploaded
  // to their own S3 subfolder (see /api/documents POST) for easy batch
  // processing later.
  const handleTypedUpload = async (type: string, input: HTMLInputElement | null) => {
    const files = input?.files;
    if (!files || !files.length) return;
    setUploading(true);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("file", f));
    fd.append("documentType", type);
    fd.append("candidateId", id);
    await fetch("/api/documents", { method: "POST", body: fd });
    setUploading(false);
    if (input) input.value = "";
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

  // The pipeline shown here follows whatever stages are configured under
  // Settings -> Workflow Stages when any are defined there, falling back to
  // the built-in default list otherwise — same fallback rule already used
  // by the Change Stage dialog below, now shared so the two never disagree.
  const pipelineStages = workflowStages.length > 0
    ? workflowStages.slice().sort((a, b) => a.stepOrder - b.stepOrder).map((s) => ({ key: s.key, label: s.label, step: s.stepOrder }))
    : CANDIDATE_STAGES.map((s) => ({ key: s.key, label: s.label, step: s.step }));

  const currentStageInfo = pipelineStages.find((s) => s.key === candidate.currentStage);
  const currentIdx = pipelineStages.findIndex((s) => s.key === candidate.currentStage);
  const requiresPsychometric = candidate.mrf?.designation?.requiresPsychometric ?? true;

  const nextStages = pipelineStages.filter((s, idx) => {
    if (idx <= currentIdx) return false;
    if (s.key === "PSYCHOMETRIC_TEST" && !requiresPsychometric) return false;
    return true;
  });

  // Aadhar/Passport get their own sections below, so they're excluded from
  // the generic Documents list to avoid showing every file twice.
  const aadharDocs = documents.filter((d) => d.documentType === "AADHAAR");
  const passportDocs = documents.filter((d) => d.documentType === "PASSPORT");
  const otherDocs = documents.filter((d) => d.documentType !== "AADHAAR" && d.documentType !== "PASSPORT");

  const renderDocRow = (doc: Document) => {
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
  };

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
            <Pencil className="h-4 w-4" /> Edit/Generate offer letter
          </Button>
        )}
        {canManage && (
          <Button onClick={() => { setToStage(""); setNotes(""); setStageDialog(true); }}>
            <ChevronRight className="h-4 w-4" /> Change Stage
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
                  <p className="text-xs text-gray-500">{candidate.mrf.department.name}{candidate.mrf.orgUnit ? ` · ${candidate.mrf.orgUnit.name}` : ""}</p>
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
              {pipelineStages.map((stage, idx) => {
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
                const toS = pipelineStages.find((s) => s.key === h.toStage);
                return (
                  <div key={h.id} className="flex items-start gap-3 border-l-2 border-gray-200 pl-4 py-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {h.fromStage && <span className="text-xs text-gray-400">{pipelineStages.find((s) => s.key === h.fromStage)?.label}</span>}
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

      {/* Aadhar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Aadhar</CardTitle>
            {canManage && (
              <>
                <input ref={aadharRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={() => handleTypedUpload("AADHAAR", aadharRef.current)} />
                <Button size="sm" variant="outline" onClick={() => aadharRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Upload
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {aadharDocs.length === 0 ? (
            <p className="text-sm text-gray-500">No Aadhar documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">{aadharDocs.map(renderDocRow)}</div>
          )}
        </CardContent>
      </Card>

      {/* Passport */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Passport</CardTitle>
            {canManage && (
              <>
                <input ref={passportRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={() => handleTypedUpload("PASSPORT", passportRef.current)} />
                <Button size="sm" variant="outline" onClick={() => passportRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Upload
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {passportDocs.length === 0 ? (
            <p className="text-sm text-gray-500">No passport documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">{passportDocs.map(renderDocRow)}</div>
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
                <input ref={fileRef} type="file" multiple className="hidden" onChange={() => handleTypedUpload(docType, fileRef.current)} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Upload
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {otherDocs.length === 0 ? (
            <p className="text-sm text-gray-500">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">{otherDocs.map(renderDocRow)}</div>
          )}
        </CardContent>
      </Card>

      {/* Edit Candidate Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
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
            <div className="space-y-1 relative">
              <Label>Linked MRF</Label>
              <Input
                value={mrfQuery}
                onChange={(e) => {
                  setMrfQuery(e.target.value);
                  setShowMrfDropdown(true);
                  if (!e.target.value.trim()) setEditForm({ ...editForm, mrfId: "none" });
                }}
                onFocus={(e) => { setShowMrfDropdown(true); e.target.select(); }}
                onBlur={() => setTimeout(() => setShowMrfDropdown(false), 150)}
                placeholder="Search MRF by title or number..."
                autoComplete="off"
              />
              {showMrfDropdown && (() => {
                const q = mrfQuery.trim().toLowerCase();
                const filteredMrfs = q
                  ? mrfs.filter((m) => `${m.title} ${m.referenceNumber} ${m.mrfNumber || ""}`.toLowerCase().includes(q))
                  : mrfs;
                return (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-blue-50"
                      onMouseDown={() => { setEditForm({ ...editForm, mrfId: "none" }); setMrfQuery(""); setShowMrfDropdown(false); }}
                    >
                      — None (unlink) —
                    </button>
                    {filteredMrfs.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                        onMouseDown={() => {
                          setEditForm({ ...editForm, mrfId: m.id });
                          setMrfQuery(`${m.mrfNumber || m.referenceNumber} – ${m.title}`);
                          setShowMrfDropdown(false);
                        }}
                      >
                        {m.mrfNumber || m.referenceNumber} – {m.title}
                      </button>
                    ))}
                    {filteredMrfs.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No matching MRFs</p>}
                  </div>
                );
              })()}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Designation</Label>
                <Input value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} placeholder="e.g. Software Engineer" />
              </div>
              <div className="space-y-1">
                <Label>Grade</Label>
                <Input value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })} placeholder="e.g. M3" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Location</Label>
                <Input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} placeholder="e.g. Gandhidham" />
              </div>
              <div className="space-y-1">
                <Label>Date of Joining</Label>
                <Input type="date" value={editForm.dateOfJoining} onChange={(e) => setEditForm({ ...editForm, dateOfJoining: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Address</Label>
                <div className="flex items-center gap-2">
                  <Select value={addressSourceType} onValueChange={setAddressSourceType}>
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AADHAAR">Aadhar</SelectItem>
                      <SelectItem value="PASSPORT">Passport</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={handleFetchAddress} disabled={fetchingAddress}>
                    {fetchingAddress ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Fetch Address
                  </Button>
                </div>
              </div>
              <Textarea rows={2} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Full address" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Ref. No.</Label>
                <Input value={editForm.refNo} onChange={(e) => setEditForm({ ...editForm, refNo: e.target.value })} placeholder="e.g. C/2026-27/HR/746" />
              </div>
              <div className="space-y-1">
                <Label>Recruitment For</Label>
                <Select value={editForm.recruitmentEntity} onValueChange={(v) => setEditForm({ ...editForm, recruitmentEntity: v })}>
                  <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
                  <SelectContent>
                    {RECRUITMENT_ENTITIES.map((entity) => (
                      <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.isFresher}
                onChange={(e) => setEditForm({ ...editForm, isFresher: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm">Is Fresher</span>
            </label>
            <div className="space-y-1">
              <Label>Resume</Label>
              {candidate.resumeUrl ? (
                <div className="flex items-center gap-3">
                  <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                    View uploaded resume
                  </a>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDeleteResume}
                    disabled={deletingResume}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    {deletingResume ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete
                  </Button>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                    className="text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-50"
                  />
                  <p className="text-xs text-gray-500">PDF, DOC, DOCX, PNG, or JPG. Uploaded when you save.</p>
                </>
              )}
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t">
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button variant="outline" onClick={handleGenerateOfferLetter} disabled={!editForm.firstName || !editForm.email || editSubmitting}>
              {editSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate offer letter
            </Button>
            <Button onClick={handleEdit} disabled={!editForm.firstName || !editForm.email || editSubmitting}>
              {editSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offer Letter PDF Preview */}
      <Dialog
        open={offerLetterPreviewOpen}
        onOpenChange={(open) => {
          setOfferLetterPreviewOpen(open);
          // Closing the preview (X, Escape, outside click) returns to Edit
          // Candidate Details rather than dropping back to the plain detail
          // page, since that's where this preview was generated from.
          if (!open) setEditDialog(true);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Offer Letter</DialogTitle>
          </DialogHeader>
          <OfferLetterPdfPreview
            candidate={{
              firstName: candidate.firstName,
              lastName: candidate.lastName,
              designation: candidate.designation,
              grade: candidate.grade,
              location: candidate.location,
              dateOfJoining: candidate.dateOfJoining,
              address: candidate.address,
              refNo: candidate.refNo,
              recruitmentEntity: candidate.recruitmentEntity,
              isFresher: candidate.isFresher,
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Change Stage Dialog — bidirectional */}
      <Dialog open={stageDialog} onOpenChange={setStageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Candidate Stage</DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              Current: <span className="font-medium text-gray-800">{currentStageInfo?.label || candidate.currentStage}</span>
            </p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Move to Stage *</Label>
              <Select value={toStage} onValueChange={setToStage}>
                <SelectTrigger><SelectValue placeholder="Select stage…" /></SelectTrigger>
                <SelectContent>
                  {(workflowStages.length > 0 ? workflowStages : CANDIDATE_STAGES.map((s) => ({ key: s.key, label: s.label, stepOrder: s.step, id: s.key }))).map((s) => {
                    const isCurrent = s.key === candidate.currentStage;
                    const activeStages = workflowStages.length > 0 ? workflowStages : CANDIDATE_STAGES.map((cs) => ({ key: cs.key, stepOrder: cs.step }));
                    const currentOrder = activeStages.find((a) => a.key === candidate.currentStage)?.stepOrder ?? 0;
                    const direction = s.stepOrder > currentOrder ? "↑" : s.stepOrder < currentOrder ? "↓" : "";
                    return (
                      <SelectItem key={s.key} value={s.key} disabled={isCurrent}>
                        {direction && <span className={`mr-1 text-xs ${direction === "↑" ? "text-green-600" : "text-orange-500"}`}>{direction}</span>}
                        {s.label}{isCurrent ? " (current)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {toStage && toStage !== candidate.currentStage && (() => {
              const activeStages = workflowStages.length > 0 ? workflowStages : CANDIDATE_STAGES.map((cs) => ({ key: cs.key, stepOrder: cs.step }));
              const currentOrder = activeStages.find((a) => a.key === candidate.currentStage)?.stepOrder ?? 0;
              const targetOrder = activeStages.find((a) => a.key === toStage)?.stepOrder ?? 0;
              const isBack = targetOrder < currentOrder;
              const isSkip = targetOrder > currentOrder + 1;
              return (isBack || isSkip) ? (
                <div className={`rounded-lg border p-3 text-sm ${isBack ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
                  {isBack ? "⚠ Moving backward — this will reopen a previous stage." : "⏩ Skipping one or more stages."}
                </div>
              ) : null;
            })()}
            <div className="space-y-2">
              <Label>Notes / Reason</Label>
              <Textarea
                placeholder="Interview result, correction reason, notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialog(false)}>Cancel</Button>
            <Button onClick={handleStageChange} disabled={!toStage || toStage === candidate.currentStage || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
