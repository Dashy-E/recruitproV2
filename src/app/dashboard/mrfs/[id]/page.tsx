"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle, XCircle, Clock, Users, Loader2, Send, RefreshCw, Pencil, FileText, SkipForward, Upload, Paperclip } from "lucide-react";
import { formatDate, MRF_STATUSES, CANDIDATE_STAGES } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { MRFPdfPreview } from "@/components/mrf-pdf-preview";
import { toast } from "@/hooks/use-toast";

interface MRFDetail {
  id: string; referenceNumber: string; mrfNumber: string | null; title: string; status: string;
  vacancyCount: number; justification: string;
  fillerName: string | null; fillerDesignation: string | null; ctcRange: string | null;
  location: string | null; reportingTo: string | null; jobProfile: string | null;
  vacancyType: string | null;
  replacedEmployeeName: string | null; replacedEmployeeCTC: string | null;
  replacementFor: string | null; replacementReason: string | null;
  isNewRole: boolean; isBusinessExpansion: boolean; newRoleJustification: string | null;
  isBudgeted: boolean | null; proposedGrade: string | null;
  minAge: number | null; maxAge: number | null;
  minQualification: string | null; preferredQualification: string | null;
  workExperience: string | null; industryBackground: string | null; otherSpecs: string | null;
  contributionJustified: boolean;
  createdAt: string; approvedAt: string | null; rejectedAt: string | null; rejectionReason: string | null;
  orgUnit: { name: string; path: string } | null;
  department: { name: string };
  designation: { title: string; requiresPsychometric: boolean } | null;
  createdBy: { name: string; email: string; signatureUrl: string | null };
  approvalRecords: ApprovalRecord[];
  candidates: CandidateSummary[];
  documents: MRFDocument[];
  // Server-computed: is the requesting user genuinely the designated
  // approver for this MRF's current stage (org/department-scoped)? See
  // src/lib/mrf-approval.ts — kept server-side so the Approve button can't
  // drift out of sync with what the approve endpoint will actually allow.
  canApprove: boolean;
  // Reminder hold ("snooze") — pauses the every-3-days reminder email to the
  // current approver without blocking Approve/Reject. See
  // src/lib/mrf-reminders.ts and /api/mrfs/[id]/hold.
  isOnHold: boolean;
  holdUntil: string | null;
  holdIndefinite: boolean;
  heldBy: { name: string } | null;
}

interface ApprovalRecord {
  id: string; level: string; approverName: string; approverRole: string | null; approverDesignation: string | null;
  status: string; notes: string | null; recordedAt: string;
  isAutoApproved: boolean;
  approver: { name: string; signatureUrl: string | null } | null;
}

interface CandidateSummary {
  id: string; firstName: string; lastName: string; email: string;
  currentStage: string; aiScore: number | null;
}

interface MRFDocument {
  id: string; name: string; fileUrl: string | null; fileSize: number;
  createdAt: string; uploadedBy: { name: string } | null;
}

// level here is the stage-grouping key stored on RECRUIT_T_MRFApprovalRecord
// (see LEVEL_LABEL in approve/route.ts) — stage 1's label is generic since
// either a Divisional or a Country Manager may have actually approved it
// (the record's own approverRole shows who really acted).
const APPROVAL_LEVELS = [
  { key: "DIVISIONAL_MANAGER", label: "Divisional / Country Manager", pendingStatus: "PENDING_DIVISIONAL" },
  { key: "COUNTRY_SUPERVISOR", label: "Country Supervisor", pendingStatus: "PENDING_COUNTRY_SUPERVISOR" },
  { key: "FUNCTIONAL_HEAD", label: "Functional Head", pendingStatus: "PENDING_FUNCTIONAL" },
  { key: "FINAL_APPROVAL", label: "Final Approval", pendingStatus: "PENDING_FINAL_APPROVAL" },
];

const NEXT_LEVEL_LABEL: Record<string, string> = {
  PENDING_COUNTRY_SUPERVISOR: "Country Supervisor",
  PENDING_FUNCTIONAL: "Functional Head",
  PENDING_FINAL_APPROVAL: "Document Upload Team",
};

export default function MRFDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const approvalLevel = (session?.user as { approvalLevel?: string | null })?.approvalLevel ?? null;
  const [mrf, setMrf] = useState<MRFDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/roles")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setRoleLabels(Object.fromEntries(d.map((r: { key: string; label: string }) => [r.key, r.label])));
      });
  }, []);

  const myDesignation = roleLabels[role] || role.replace(/_/g, " ");

  // Approve/reject/skip/finalApprove/hold dialog
  const [approvalDialog, setApprovalDialog] = useState<"approve" | "reject" | "skip" | "finalApprove" | "hold" | null>(null);
  const [approverName, setApproverName] = useState("");
  const [approverDesignation, setApproverDesignation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Send-to-next-approver modal (shown after successful approval when MRF still pending)
  const [sendNextOpen, setSendNextOpen] = useState(false);
  const [nextApproverEmail, setNextApproverEmail] = useState("");
  const [nextApproverMessage, setNextApproverMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [postApprovalStatus, setPostApprovalStatus] = useState("");
  const [eligibleApprovers, setEligibleApprovers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  // Lets the sender correct the email inline if the selected approver's
  // address on file is wrong, instead of being locked to the dropdown value.
  const [editingApproverEmail, setEditingApproverEmail] = useState(false);

  // Reminder hold ("snooze") state
  const [holding, setHolding] = useState(false);

  // Restart approval dialog (for REJECTED MRFs)
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Requisition form PDF preview
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  // Supporting document upload (Final Approval gate)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const permissions = (session?.user as { permissions?: string[] })?.permissions || [];
  const canManageMrf = permissions.includes("MANAGE_MRF");
  const canSendApprovalEmail = permissions.includes("SEND_MRF_APPROVAL_EMAIL");
  const isUniversalApprover = approvalLevel === "ANY";
  const isManagerForThisLevel = !!mrf?.canApprove;
  // PENDING_FINAL_APPROVAL isn't part of the DIVISIONAL/SUPERVISOR/FUNCTIONAL
  // role ladder at all (it's permission-based, see canUploadDocuments/
  // canFinalDecide below) — excluded here even though its name also starts
  // with "PENDING", so the old Approve/Reject/Skip buttons don't show for it.
  const isFinalApprovalStage = mrf?.status === "PENDING_FINAL_APPROVAL";
  const canAct = (isUniversalApprover || isManagerForThisLevel) && mrf?.status?.startsWith("PENDING") && !isFinalApprovalStage;
  const isManagerSelfApproval = isManagerForThisLevel && !isUniversalApprover;
  const canSubmitApproval = isManagerSelfApproval ? true : !!approverName;
  // Skip is purely permission-based — independent of being this stage's
  // designated approver, e.g. "the Country Supervisor is unavailable, so
  // someone with this permission pushes it to Functional Head instead".
  const canSkip = permissions.includes("SKIP_MRF_APPROVAL") && !!mrf?.status?.startsWith("PENDING") && !isFinalApprovalStage;
  // Document upload and the Final Approve/Reject/Hold decision are both
  // gated purely on their own permissions, independent of the approval
  // hierarchy above — see UPLOAD_MRF_DOCUMENTS/FINAL_APPROVE_MRF.
  const canUploadDocuments = permissions.includes("UPLOAD_MRF_DOCUMENTS") && isFinalApprovalStage;
  const canFinalDecide = permissions.includes("FINAL_APPROVE_MRF") && isFinalApprovalStage && (mrf?.documents?.length ?? 0) > 0;

  const fetchMRF = () => {
    fetch(`/api/mrfs/${id}`)
      .then((r) => r.json())
      .then((data) => { setMrf(data); setLoading(false); });
  };

  useEffect(() => { fetchMRF(); }, [id]);

  // Who's eligible to act at the MRF's current pending stage — same
  // org/department-scoped rules used to pick auto-notification recipients,
  // surfaced here so "send to next approver" is a dropdown, not free text.
  useEffect(() => {
    if (!sendNextOpen) return;
    setLoadingApprovers(true);
    setNextApproverEmail("");
    setEditingApproverEmail(false);
    fetch(`/api/mrfs/${id}/eligible-approvers`)
      .then((r) => r.json())
      .then((d) => setEligibleApprovers(Array.isArray(d) ? d : []))
      .finally(() => setLoadingApprovers(false));
  }, [sendNextOpen, id]);

  const openApprovalDialog = (action: "approve" | "reject" | "skip" | "finalApprove" | "hold") => {
    setApproverName(session?.user?.name || "");
    setApproverDesignation(myDesignation);
    setApprovalDialog(action);
  };

  const handleApproval = async () => {
    setSubmitting(true);
    const res = await fetch(`/api/mrfs/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: approvalDialog, approverName, approverDesignation, notes }),
    });
    setSubmitting(false);
    setApprovalDialog(null);
    setApproverName(""); setApproverDesignation(""); setNotes("");

    if (res.ok && (approvalDialog === "approve" || approvalDialog === "skip")) {
      // Re-fetch to get new status, then decide whether to show send-next modal
      const updated = await fetch(`/api/mrfs/${id}`).then((r) => r.json());
      setMrf(updated);
      const newStatus = updated.status;
      // If still pending (not APPROVED/REJECTED), offer to send to next approver
      if (newStatus && newStatus.startsWith("PENDING")) {
        setPostApprovalStatus(newStatus);
        setSendNextOpen(true);
      }
    } else {
      fetchMRF();
    }
  };

  const handleSendNext = async () => {
    if (!nextApproverEmail) return;
    setSending(true);
    setSendError("");
    const res = await fetch(`/api/mrfs/${id}/send-approval-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toEmail: nextApproverEmail, message: nextApproverMessage }),
    });
    setSending(false);
    if (res.ok) {
      setSendNextOpen(false);
      setNextApproverEmail(""); setNextApproverMessage("");
      toast({ variant: "success", title: "Email sent", description: `Notification sent to ${nextApproverEmail}.` });
    } else {
      const data = await res.json().catch(() => ({}));
      setSendError(data.error || "Failed to send email.");
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    await fetch(`/api/mrfs/${id}/restart`, { method: "POST" });
    setRestarting(false);
    setRestartConfirmOpen(false);
    fetchMRF();
  };

  const handleHoldSelect = async (value: string) => {
    setHolding(true);
    const body = value === "indefinite" ? { indefinite: true } : { durationDays: parseInt(value, 10) };
    await fetch(`/api/mrfs/${id}/hold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setHolding(false);
    fetchMRF();
  };

  const handleReleaseHold = async () => {
    setHolding(true);
    await fetch(`/api/mrfs/${id}/hold`, { method: "DELETE" });
    setHolding(false);
    fetchMRF();
  };

  const ALLOWED_DOC_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const invalid = files.find((f) => !ALLOWED_DOC_EXTENSIONS.includes(f.name.slice(f.name.lastIndexOf(".")).toLowerCase()));
    if (invalid) {
      setUploadError(`"${invalid.name}": only PDF, PNG, JPG, or JPEG files are accepted`);
      setSelectedFiles([]);
      e.target.value = "";
      return;
    }
    setUploadError("");
    setSelectedFiles(files);
  };

  const handleUploadDocuments = async () => {
    if (!selectedFiles.length) return;
    setUploadingDocs(true);
    setUploadError("");
    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append("file", f));
    const res = await fetch(`/api/mrfs/${id}/documents`, { method: "POST", body: formData });
    setUploadingDocs(false);
    if (res.ok) {
      setSelectedFiles([]);
      fetchMRF();
      toast({ variant: "success", title: "Documents uploaded" });
    } else {
      const data = await res.json().catch(() => ({}));
      setUploadError(data.error || "Failed to upload documents.");
    }
  };

  if (loading) return <div className="py-20 text-center text-gray-500"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>;
  if (!mrf) return <div className="py-20 text-center text-gray-500">MRF not found.</div>;

  const statusInfo = MRF_STATUSES[mrf.status as keyof typeof MRF_STATUSES];
  const nextLevelLabel = NEXT_LEVEL_LABEL[postApprovalStatus] || "Next Approver";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-start">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Link href="/dashboard/mrfs">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-900">{mrf.title}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusInfo?.color}`}>
                {statusInfo?.label || mrf.status}
              </span>
              {mrf.isOnHold && (
                <span className="rounded-full px-3 py-1 text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  On hold{mrf.heldBy ? ` by ${mrf.heldBy.name}` : ""}
                  {mrf.holdIndefinite ? " until changed" : mrf.holdUntil ? ` until ${formatDate(mrf.holdUntil)}` : ""}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 font-mono mt-1">
              Ref: {mrf.referenceNumber}
              {mrf.mrfNumber && <> · MRF No: {mrf.mrfNumber}</>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setPdfPreviewOpen(true)} className="print:hidden">
            <FileText className="h-4 w-4" /> Preview MRF
          </Button>
          {mrf.status === "REJECTED" && canManageMrf && (
            <>
              <Link href={`/dashboard/mrfs/${id}/edit`}>
                <Button variant="outline">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              </Link>
              <Button variant="outline" onClick={() => setRestartConfirmOpen(true)} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                <RefreshCw className="h-4 w-4" /> Restart Approval
              </Button>
            </>
          )}
          {canAct && (
            <>
              {mrf.isOnHold ? (
                <Button
                  variant="outline"
                  onClick={handleReleaseHold}
                  disabled={holding}
                  className="text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                  {holding && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Clock className="h-4 w-4" /> Release Hold
                </Button>
              ) : (
                <Select value="" onValueChange={handleHoldSelect} disabled={holding}>
                  <SelectTrigger className="w-auto text-purple-600 border-purple-200">
                    <Clock className="h-4 w-4" />
                    <SelectValue placeholder="Hold" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Hold 1 day</SelectItem>
                    <SelectItem value="15">Hold 15 days</SelectItem>
                    <SelectItem value="30">Hold 1 month</SelectItem>
                    <SelectItem value="90">Hold 3 months</SelectItem>
                    <SelectItem value="180">Hold 6 months</SelectItem>
                    <SelectItem value="365">Hold 1 year</SelectItem>
                    <SelectItem value="indefinite">Hold until I change</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" onClick={() => openApprovalDialog("reject")} className="text-red-600 border-red-200 hover:bg-red-50">
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button onClick={() => openApprovalDialog("approve")}>
                <CheckCircle className="h-4 w-4" />
                {isManagerSelfApproval ? "Approve" : "Record Approval"}
              </Button>
            </>
          )}
          {canSkip && (
            <Button
              variant="outline"
              onClick={() => openApprovalDialog("skip")}
              className="text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              <SkipForward className="h-4 w-4" /> Skip Level
            </Button>
          )}
          {canFinalDecide && (
            <>
              <Button
                variant="outline"
                onClick={() => openApprovalDialog("hold")}
                className="text-purple-600 border-purple-200 hover:bg-purple-50"
              >
                <Clock className="h-4 w-4" /> Hold
              </Button>
              <Button variant="outline" onClick={() => openApprovalDialog("reject")} className="text-red-600 border-red-200 hover:bg-red-50">
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button onClick={() => openApprovalDialog("finalApprove")} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4" /> Final Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">{mrf.title}</h1>
        <p className="font-mono text-sm text-gray-600">{mrf.mrfNumber || mrf.referenceNumber} · {statusInfo?.label || mrf.status}</p>
      </div>

      {mrf.status === "REJECTED" && mrf.rejectionReason && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-medium text-red-700">Rejected: {mrf.rejectionReason}</p>
          {canManageMrf && (
            <p className="text-xs text-red-600 mt-1">You can edit this MRF and restart the approval process.</p>
          )}
        </div>
      )}

      {isFinalApprovalStage && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Supporting Documents</CardTitle>
            <p className="text-sm text-gray-500">
              Upload supporting files before a final decision can be made. Accepted formats: PDF, PNG, JPG, JPEG.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {mrf.documents.length > 0 ? (
              <div className="space-y-2">
                {mrf.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-md border border-gray-100 px-3 py-2 text-sm">
                    <Paperclip className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      {doc.fileUrl ? (
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline truncate block">
                          {doc.name}
                        </a>
                      ) : (
                        <span className="font-medium text-gray-700 truncate block">{doc.name}</span>
                      )}
                      <p className="text-xs text-gray-400">
                        {(doc.fileSize / 1024).toFixed(0)} KB · {doc.uploadedBy?.name || "Unknown"} · {formatDate(doc.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No documents uploaded yet.</p>
            )}

            {canUploadDocuments && (
              <div className="pt-2 border-t space-y-2">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-50"
                />
                {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
                <Button size="sm" onClick={handleUploadDocuments} disabled={!selectedFiles.length || uploadingDocs}>
                  {uploadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* MRF Details */}
        <Card>
          <CardHeader><CardTitle>MRF Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: "Org Unit", value: mrf.orgUnit?.path || mrf.orgUnit?.name || "—" },
              { label: "Department", value: mrf.department.name },
              { label: "Designation", value: mrf.designation?.title || "—" },
              { label: "CTC Range", value: mrf.ctcRange || "—" },
              { label: "Vacancies", value: mrf.vacancyCount },
              { label: "Raised By", value: mrf.fillerName ? `${mrf.fillerName}${mrf.fillerDesignation ? ` (${mrf.fillerDesignation})` : ""}` : mrf.createdBy.name },
              { label: "Created", value: formatDate(mrf.createdAt) },
              { label: "Approved", value: mrf.approvedAt ? formatDate(mrf.approvedAt) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-right">{String(value)}</span>
              </div>
            ))}
            {mrf.designation && (
              <div className="flex justify-between">
                <span className="text-gray-500">Psychometric Required</span>
                <span className={`font-medium ${mrf.designation.requiresPsychometric ? "text-orange-600" : "text-gray-700"}`}>
                  {mrf.designation.requiresPsychometric ? "Yes" : "No"}
                </span>
              </div>
            )}
            {mrf.justification && (
              <div className="pt-2 border-t">
                <p className="text-gray-500 mb-1">Justification</p>
                <p className="text-gray-800">{mrf.justification}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Timeline */}
        <Card className="print:hidden">
          <CardHeader><CardTitle>Approval Progress</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {APPROVAL_LEVELS.map((level, idx) => {
                const record = mrf.approvalRecords.find((r) => r.level === level.key);
                const currentPendingStatus = mrf.status;
                const isCurrentLevel = currentPendingStatus === level.pendingStatus;
                const isApproved = record?.status === "APPROVED";
                const isRejected = record?.status === "REJECTED";
                const isSkipped = record?.status === "SKIPPED";
                const isHeld = record?.status === "HELD";
                return (
                  <div key={level.key} className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                      ${isApproved ? "bg-green-100 text-green-600" :
                        isRejected ? "bg-red-100 text-red-600" :
                        isSkipped ? "bg-amber-100 text-amber-600" :
                        isHeld ? "bg-purple-100 text-purple-600" :
                        isCurrentLevel ? "bg-blue-100 text-blue-600" :
                        "bg-gray-100 text-gray-400"}`}>
                      {isApproved ? <CheckCircle className="h-4 w-4" /> :
                       isRejected ? <XCircle className="h-4 w-4" /> :
                       isSkipped ? <SkipForward className="h-4 w-4" /> :
                       isHeld ? <Clock className="h-4 w-4" /> :
                       isCurrentLevel ? <Clock className="h-4 w-4" /> :
                       <span className="text-xs">{idx + 1}</span>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{level.label}</p>
                      {record ? (
                        <>
                          <p className="text-xs text-gray-500">
                            {isSkipped ? "Skipped by " : isHeld ? "Held by " : ""}{record.approverName} · {formatDate(record.recordedAt)}
                          </p>
                          {record.notes && <p className="text-xs text-gray-600 mt-0.5 italic">"{record.notes}"</p>}
                        </>
                      ) : isCurrentLevel ? (
                        <p className="text-xs text-blue-500">Awaiting {level.label} approval</p>
                      ) : (
                        <p className="text-xs text-gray-400">Pending</p>
                      )}
                    </div>
                    {(isApproved || isRejected || isSkipped || isHeld) && (
                      <Badge variant={isApproved ? "success" : isSkipped || isHeld ? "warning" : "destructive"} className="shrink-0 mt-0.5">
                        {isApproved ? "Approved" : isSkipped ? "Skipped" : isHeld ? "On Hold" : "Rejected"}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Send to next approver button (if pending and permitted) */}
            {mrf.status.startsWith("PENDING") && canSendApprovalEmail && (
              <div className="mt-4 pt-4 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => { setPostApprovalStatus(mrf.status); setSendNextOpen(true); }}
                >
                  <Send className="h-3.5 w-3.5" />
                  Send Email to {NEXT_LEVEL_LABEL[mrf.status] || "Approver"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Candidates Table */}
      {mrf.candidates.length > 0 && (
        <Card className="print:hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Candidates ({mrf.candidates.length})
              </CardTitle>
              <Link href={`/dashboard/candidates?mrfId=${mrf.id}`} className="text-sm text-blue-600 hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>AI Score</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mrf.candidates.map((c) => {
                  const stage = CANDIDATE_STAGES.find((s) => s.key === c.currentStage);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
                      <TableCell className="text-gray-500 text-sm">{c.email}</TableCell>
                      <TableCell>
                        <Badge variant="default">{stage?.label || c.currentStage}</Badge>
                      </TableCell>
                      <TableCell>
                        {c.aiScore != null ? (
                          <span className={`font-medium ${c.aiScore >= 70 ? "text-green-600" : "text-orange-600"}`}>
                            {c.aiScore.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </TableCell>
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
          </CardContent>
        </Card>
      )}

      {/* Approve/Reject/Skip/Final Approve/Hold Dialog */}
      <Dialog open={approvalDialog !== null} onOpenChange={() => setApprovalDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalDialog === "approve" ? "Approve MRF" :
               approvalDialog === "skip" ? "Skip Approval Level" :
               approvalDialog === "finalApprove" ? "Final Approve MRF" :
               approvalDialog === "hold" ? "Hold Final Decision" :
               "Reject MRF"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {approvalDialog === "skip" && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                This bypasses the current approval level entirely and moves the MRF straight to the next stage, without recording an actual approval at this level.
              </div>
            )}
            {approvalDialog === "hold" && (
              <div className="rounded-md bg-purple-50 border border-purple-200 p-3 text-sm text-purple-800">
                Defers the final decision — Final Approve and Reject stay available afterward, nothing is locked in yet.
              </div>
            )}
            {approvalDialog === "finalApprove" && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                This assigns the MRF Number and completes the approval process. This cannot be undone.
              </div>
            )}
            <div className="space-y-2">
              <Label>{approvalDialog === "skip" ? "Skipped By" : "Approver Name"}</Label>
              <Input value={approverName} disabled />
              <p className="text-xs text-gray-400">Taken from your account — this is who the system records.</p>
            </div>
            <div className="space-y-2">
              <Label>{approvalDialog === "skip" ? "Designation" : "Approver Designation"}</Label>
              <Input
                placeholder="Job title / designation"
                value={approverDesignation}
                onChange={(e) => setApproverDesignation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                {approvalDialog === "reject" ? "Reason for Rejection *" :
                 approvalDialog === "skip" ? "Reason for Skipping *" :
                 approvalDialog === "hold" ? "Reason for Hold *" :
                 "Notes / Reference"}
              </Label>
              <Textarea
                placeholder={
                  approvalDialog === "approve" || approvalDialog === "finalApprove" ? "Email ref / document number..." :
                  approvalDialog === "skip" ? "Why this level is being skipped..." :
                  approvalDialog === "hold" ? "Why this decision is being held..." :
                  "Reason for rejection..."
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialog(null)}>Cancel</Button>
            <Button
              onClick={handleApproval}
              disabled={!canSubmitApproval || ((approvalDialog === "reject" || approvalDialog === "skip" || approvalDialog === "hold") && !notes.trim()) || submitting}
              variant={approvalDialog === "reject" ? "destructive" : approvalDialog === "skip" || approvalDialog === "hold" ? "outline" : "default"}
              className={approvalDialog === "skip" ? "text-amber-700 border-amber-300 hover:bg-amber-50" : approvalDialog === "hold" ? "text-purple-700 border-purple-300 hover:bg-purple-50" : ""}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {approvalDialog === "approve" ? "Approve" :
               approvalDialog === "skip" ? "Skip Level" :
               approvalDialog === "finalApprove" ? "Final Approve" :
               approvalDialog === "hold" ? "Hold" :
               "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Next Approver Modal */}
      <Dialog open={sendNextOpen} onOpenChange={(o) => { if (!o) setSendNextOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Notify {nextLevelLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              The MRF has been approved at this level and is now awaiting <strong>{nextLevelLabel}</strong> approval.
              Send them an email with the direct MRF link.
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Approver *</Label>
                {!loadingApprovers && eligibleApprovers.length > 0 && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    onClick={() => setEditingApproverEmail((v) => !v)}
                  >
                    <Pencil className="h-3 w-3" />
                    {editingApproverEmail ? "Choose from list" : "Wrong email? Edit"}
                  </button>
                )}
              </div>
              {loadingApprovers ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading eligible approvers…
                </div>
              ) : eligibleApprovers.length > 0 && !editingApproverEmail ? (
                <Select value={nextApproverEmail} onValueChange={setNextApproverEmail}>
                  <SelectTrigger><SelectValue placeholder="Select an approver" /></SelectTrigger>
                  <SelectContent>
                    {eligibleApprovers.map((a) => (
                      <SelectItem key={a.id} value={a.email}>{a.name} — {a.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  {eligibleApprovers.length === 0 && (
                    <p className="text-xs text-amber-600">
                      No eligible approver found with org/department access for this stage — enter an email manually.
                    </p>
                  )}
                  <Input
                    type="email"
                    placeholder="next.approver@company.com"
                    value={nextApproverEmail}
                    onChange={(e) => setNextApproverEmail(e.target.value)}
                  />
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea
                rows={3}
                placeholder="Add a personal note..."
                value={nextApproverMessage}
                onChange={(e) => setNextApproverMessage(e.target.value)}
              />
            </div>
            {sendError && <p className="text-sm text-red-600">{sendError}</p>}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setSendNextOpen(false)}>
              Skip
            </Button>
            <Button onClick={handleSendNext} disabled={!nextApproverEmail || sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Send className="h-4 w-4" />
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restart Approval Confirmation */}
      <Dialog open={restartConfirmOpen} onOpenChange={setRestartConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Restart Approval Process?</DialogTitle>
          </DialogHeader>
          <div className="py-3 text-sm text-gray-600 space-y-2">
            <p>This will:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Clear all previous approval records for this MRF</li>
              <li>Reset the status to <strong>Pending Divisional Approval</strong></li>
            </ul>
            <p>You can edit the MRF before restarting. This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestartConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleRestart} disabled={restarting}>
              {restarting && <Loader2 className="h-4 w-4 animate-spin" />}
              <RefreshCw className="h-4 w-4" />
              Restart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Requisition Form PDF Preview */}
      <Dialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Manpower Requisition Form
            </DialogTitle>
          </DialogHeader>
          {mrf && <MRFPdfPreview mrf={mrf} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
