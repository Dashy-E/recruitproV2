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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle, XCircle, Clock, Users, Loader2, Send, Printer, RefreshCw, Pencil } from "lucide-react";
import { formatDate, MRF_STATUSES, CANDIDATE_STAGES } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface MRFDetail {
  id: string; mrfNumber: string; title: string; status: string;
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
  country: { name: string }; division: { name: string } | null;
  branch: { name: string } | null; department: { name: string };
  designation: { title: string; requiresPsychometric: boolean } | null;
  createdBy: { name: string; email: string };
  approvalRecords: ApprovalRecord[];
  candidates: CandidateSummary[];
}

interface ApprovalRecord {
  id: string; level: string; approverName: string; approverDesignation: string | null;
  status: string; notes: string | null; recordedAt: string;
}

interface CandidateSummary {
  id: string; firstName: string; lastName: string; email: string;
  currentStage: string; aiScore: number | null;
}

const APPROVAL_LEVELS = [
  { key: "DIVISIONAL_MANAGER", label: "Divisional Manager", pendingStatus: "PENDING_DIVISIONAL" },
  { key: "FUNCTIONAL_HEAD", label: "Functional Head", pendingStatus: "PENDING_FUNCTIONAL" },
  { key: "COUNTRY_MANAGER", label: "Country Manager", pendingStatus: "PENDING_COUNTRY" },
];

const STATUS_TO_LEVEL: Record<string, string> = {
  PENDING_DIVISIONAL: "DIVISIONAL",
  PENDING_FUNCTIONAL: "FUNCTIONAL",
  PENDING_COUNTRY: "COUNTRY",
};

const NEXT_LEVEL_LABEL: Record<string, string> = {
  PENDING_FUNCTIONAL: "Functional Head",
  PENDING_COUNTRY: "Country Manager",
};

export default function MRFDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const approvalLevel = (session?.user as { approvalLevel?: string | null })?.approvalLevel ?? null;
  const [mrf, setMrf] = useState<MRFDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Approve/reject dialog
  const [approvalDialog, setApprovalDialog] = useState<"approve" | "reject" | null>(null);
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

  // Restart approval dialog (for REJECTED MRFs)
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const permissions = (session?.user as { permissions?: string[] })?.permissions || [];
  const canManageMrf = permissions.includes("MANAGE_MRF");
  const canSendApprovalEmail = permissions.includes("SEND_MRF_APPROVAL_EMAIL");
  const isUniversalApprover = approvalLevel === "ANY";
  const isManagerForThisLevel = mrf ? !!approvalLevel && approvalLevel === STATUS_TO_LEVEL[mrf.status] : false;
  const canAct = (isUniversalApprover || isManagerForThisLevel) && mrf?.status?.startsWith("PENDING");
  const isManagerSelfApproval = isManagerForThisLevel && !isUniversalApprover;
  const canSubmitApproval = isManagerSelfApproval ? true : !!approverName;

  const fetchMRF = () => {
    fetch(`/api/mrfs/${id}`)
      .then((r) => r.json())
      .then((data) => { setMrf(data); setLoading(false); });
  };

  useEffect(() => { fetchMRF(); }, [id]);

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

    if (res.ok && approvalDialog === "approve") {
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

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="py-20 text-center text-gray-500"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>;
  if (!mrf) return <div className="py-20 text-center text-gray-500">MRF not found.</div>;

  const statusInfo = MRF_STATUSES[mrf.status as keyof typeof MRF_STATUSES];
  const nextLevelLabel = NEXT_LEVEL_LABEL[postApprovalStatus] || "Next Approver";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3 print:hidden">
        <Link href="/dashboard/mrfs">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-gray-900">{mrf.title}</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusInfo?.color}`}>
              {statusInfo?.label || mrf.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 font-mono mt-1">{mrf.mrfNumber}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {mrf.status === "APPROVED" && (
            <Button variant="outline" onClick={handlePrint} className="print:hidden">
              <Printer className="h-4 w-4" /> Print / PDF
            </Button>
          )}
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
              <Button variant="outline" onClick={() => setApprovalDialog("reject")} className="text-red-600 border-red-200 hover:bg-red-50">
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button onClick={() => setApprovalDialog("approve")}>
                <CheckCircle className="h-4 w-4" />
                {isManagerSelfApproval ? "Approve" : "Record Approval"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">{mrf.title}</h1>
        <p className="font-mono text-sm text-gray-600">{mrf.mrfNumber} · {statusInfo?.label || mrf.status}</p>
      </div>

      {mrf.status === "REJECTED" && mrf.rejectionReason && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-medium text-red-700">Rejected: {mrf.rejectionReason}</p>
          {canManageMrf && (
            <p className="text-xs text-red-600 mt-1">You can edit this MRF and restart the approval process.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* MRF Details */}
        <Card>
          <CardHeader><CardTitle>MRF Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: "Country", value: mrf.country.name },
              { label: "Division", value: mrf.division?.name || "—" },
              { label: "Branch / Office", value: mrf.branch?.name || "Country Level" },
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
                return (
                  <div key={level.key} className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                      ${isApproved ? "bg-green-100 text-green-600" :
                        isRejected ? "bg-red-100 text-red-600" :
                        isCurrentLevel ? "bg-blue-100 text-blue-600" :
                        "bg-gray-100 text-gray-400"}`}>
                      {isApproved ? <CheckCircle className="h-4 w-4" /> :
                       isRejected ? <XCircle className="h-4 w-4" /> :
                       isCurrentLevel ? <Clock className="h-4 w-4" /> :
                       <span className="text-xs">{idx + 1}</span>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{level.label}</p>
                      {record ? (
                        <>
                          <p className="text-xs text-gray-500">
                            {record.approverName} · {formatDate(record.recordedAt)}
                          </p>
                          {record.notes && <p className="text-xs text-gray-600 mt-0.5 italic">"{record.notes}"</p>}
                        </>
                      ) : isCurrentLevel ? (
                        <p className="text-xs text-blue-500">Awaiting {level.label} approval</p>
                      ) : (
                        <p className="text-xs text-gray-400">Pending</p>
                      )}
                    </div>
                    {(isApproved || isRejected) && (
                      <Badge variant={isApproved ? "success" : "destructive"} className="shrink-0 mt-0.5">
                        {isApproved ? "Approved" : "Rejected"}
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

      {/* Approve/Reject Dialog */}
      <Dialog open={approvalDialog !== null} onOpenChange={() => setApprovalDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalDialog === "approve" ? "Approve MRF" : "Reject MRF"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!isManagerSelfApproval && (
              <>
                <div className="space-y-2">
                  <Label>Approver Name *</Label>
                  <Input
                    placeholder="Name of person who approved/rejected"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Approver Designation</Label>
                  <Input
                    placeholder="Job title / designation"
                    value={approverDesignation}
                    onChange={(e) => setApproverDesignation(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>{approvalDialog === "reject" ? "Reason for Rejection *" : "Notes / Reference"}</Label>
              <Textarea
                placeholder={approvalDialog === "approve" ? "Email ref / document number..." : "Reason for rejection..."}
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
              disabled={!canSubmitApproval || (approvalDialog === "reject" && !notes) || submitting}
              variant={approvalDialog === "reject" ? "destructive" : "default"}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {approvalDialog === "approve" ? "Approve" : "Reject"}
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
              <Label>Approver Email *</Label>
              <Input
                type="email"
                placeholder="next.approver@company.com"
                value={nextApproverEmail}
                onChange={(e) => setNextApproverEmail(e.target.value)}
              />
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
    </div>
  );
}
