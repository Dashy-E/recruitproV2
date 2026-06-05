"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CANDIDATE_STAGES, formatDate } from "@/lib/utils";
import { CheckCircle, Clock, Upload, Loader2, FileText, XCircle } from "lucide-react";

interface StageHistory { id: string; toStage: string; notes: string | null; changedAt: string }
interface Document {
  id: string; name: string; documentType: string; fileUrl: string;
  approvalStatus: string; approvalNotes: string | null; createdAt: string;
}
interface OfferDetail { offeredSalary: number | null; offeredAt: string; probationEndAt: string | null; notes: string | null }
interface CandidateData {
  id: string; firstName: string; lastName: string; currentStage: string;
  aiScore: number | null;
  mrf: {
    title: string;
    department: { name: string };
    branch: { name: string };
    country: { name: string };
    designation: { title: string; requiresPsychometric: boolean } | null;
  } | null;
  stageHistory: StageHistory[];
  documents: Document[];
  offerDetail: OfferDetail | null;
}

const PRE_SHORTLIST_STAGES = ["APPLIED", "AI_SCREENING"];

const APPROVAL_ICON: Record<string, React.ElementType> = {
  PENDING: Clock,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
};
const APPROVAL_CLS: Record<string, string> = {
  PENDING: "text-yellow-600",
  APPROVED: "text-green-600",
  REJECTED: "text-red-600",
};

export default function MyApplicationPage() {
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string })?.id;

  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("IDENTIFICATION");
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCandidate = async () => {
    if (!userId) return;
    const res = await fetch("/api/candidates/me");
    if (res.ok) {
      const data = await res.json();
      setCandidate(data);
      setDocuments(data.documents || []);
    }
    setLoading(false);
  };

  const fetchDocs = async () => {
    if (!candidate) return;
    const res = await fetch(`/api/documents?candidateId=${candidate.id}`);
    if (res.ok) setDocuments(await res.json());
  };

  useEffect(() => {
    if (status === "authenticated") fetchCandidate();
  }, [status, userId]);

  const canUpload = candidate && PRE_SHORTLIST_STAGES.includes(candidate.currentStage);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !candidate) return;
    setUploadError("");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("documentType", docType);
    fd.append("candidateId", candidate.id);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json();
      setUploadError(data.error || "Upload failed.");
    } else {
      if (fileRef.current) fileRef.current.value = "";
      fetchDocs();
    }
  };

  if (status === "loading" || loading) {
    return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>;
  }

  if (!candidate) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <Clock className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No Active Application</h3>
            <p className="text-gray-500 mt-2">
              You have not been linked to any recruitment process yet. Please contact HR.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentIdx = CANDIDATE_STAGES.findIndex((s) => s.key === candidate.currentStage);
  const requiresPsychometric = candidate.mrf?.designation?.requiresPsychometric ?? true;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
        <h2 className="text-2xl font-bold">Hello, {candidate.firstName}!</h2>
        <p className="mt-1 text-blue-100">Here is your real-time recruitment progress.</p>
      </div>

      {/* Position Info */}
      {candidate.mrf && (
        <Card>
          <CardHeader><CardTitle>Your Position</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Position</span>
              <span className="font-semibold text-gray-900">{candidate.mrf.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Department</span>
              <span>{candidate.mrf.department.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Location</span>
              <span>{candidate.mrf.branch.name}, {candidate.mrf.country.name}</span>
            </div>
            {candidate.mrf.designation && (
              <div className="flex justify-between">
                <span className="text-gray-500">Designation</span>
                <span>{candidate.mrf.designation.title}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Current Stage</span>
              <Badge variant="default">
                {CANDIDATE_STAGES.find((s) => s.key === candidate.currentStage)?.label || candidate.currentStage}
              </Badge>
            </div>
            {candidate.aiScore != null && (
              <div className="flex justify-between">
                <span className="text-gray-500">AI Screening Score</span>
                <span className={`font-bold ${candidate.aiScore >= 70 ? "text-green-600" : "text-orange-600"}`}>
                  {candidate.aiScore.toFixed(1)}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Document Upload (only before SHORTLISTED) */}
      <Card className={canUpload ? "border-blue-200" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>My Documents</CardTitle>
            {canUpload && (
              <div className="flex items-center gap-2">
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["IDENTIFICATION", "RECRUITMENT", "OTHER"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
                <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Upload
                </Button>
              </div>
            )}
          </div>
          {canUpload && (
            <p className="text-xs text-blue-600 mt-1">
              You can upload documents now. HR will review and approve them before shortlisting.
            </p>
          )}
          {!canUpload && (
            <p className="text-xs text-gray-500 mt-1">
              Document uploads are closed once you reach the Shortlisted stage. Contact HR for any changes.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {uploadError && (
            <div className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-600">{uploadError}</div>
          )}
          {documents.length === 0 ? (
            <p className="text-sm text-gray-500">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => {
                const Icon = APPROVAL_ICON[doc.approvalStatus] || Clock;
                return (
                  <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline truncate block">
                        {doc.name}
                      </a>
                      <p className="text-xs text-gray-400">{doc.documentType} · {formatDate(doc.createdAt)}</p>
                      {doc.approvalNotes && <p className="text-xs text-gray-500 italic">"{doc.approvalNotes}"</p>}
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium ${APPROVAL_CLS[doc.approvalStatus] || "text-gray-500"}`}>
                      <Icon className="h-4 w-4" />
                      {doc.approvalStatus}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recruitment Pipeline */}
      <Card>
        <CardHeader><CardTitle>Recruitment Progress</CardTitle></CardHeader>
        <CardContent>
          <div className="relative">
            {CANDIDATE_STAGES.map((stage, idx) => {
              const isSkipped = stage.key === "PSYCHOMETRIC_TEST" && !requiresPsychometric;
              const status = idx < currentIdx ? "done" : idx === currentIdx ? "current" : "pending";
              const historyEntry = candidate.stageHistory.find((h) => h.toStage === stage.key);

              if (isSkipped) {
                return (
                  <div key={stage.key} className="flex items-center gap-4 py-3 opacity-40">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-sm">—</div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-400 line-through">{stage.label}</p>
                      <p className="text-xs text-gray-400">Not required for your designation</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={stage.key} className="flex items-start gap-4 py-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold
                    ${status === "done" ? "bg-green-500 text-white" :
                      status === "current" ? "bg-blue-600 text-white" :
                      "bg-gray-100 text-gray-400"}`}>
                    {status === "done" ? <CheckCircle className="h-5 w-5" /> :
                     status === "current" ? <Clock className="h-5 w-5" /> :
                     stage.step}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium
                        ${status === "done" ? "text-gray-700" :
                          status === "current" ? "text-blue-700" :
                          "text-gray-400"}`}>
                        {stage.label}
                      </p>
                      {status === "current" && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 font-medium">
                          Current Stage
                        </span>
                      )}
                    </div>
                    {historyEntry && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(historyEntry.changedAt)}
                        {historyEntry.notes ? ` · ${historyEntry.notes}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Offer Details */}
      {candidate.offerDetail && (
        <Card>
          <CardHeader><CardTitle>Offer Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {candidate.offerDetail.offeredSalary && (
              <div className="flex justify-between">
                <span className="text-gray-500">Offered Salary</span>
                <span className="font-semibold">₹{candidate.offerDetail.offeredSalary.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Offer Date</span>
              <span>{formatDate(candidate.offerDetail.offeredAt)}</span>
            </div>
            {candidate.offerDetail.probationEndAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Probation Ends</span>
                <span>{formatDate(candidate.offerDetail.probationEndAt)}</span>
              </div>
            )}
            {candidate.offerDetail.notes && (
              <div>
                <p className="text-gray-500 mb-1">Notes</p>
                <p className="text-gray-700">{candidate.offerDetail.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
