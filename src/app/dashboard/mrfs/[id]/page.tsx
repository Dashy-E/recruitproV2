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
import { ArrowLeft, CheckCircle, XCircle, Clock, Users, Loader2 } from "lucide-react";
import { formatDate, MRF_STATUSES, CANDIDATE_STAGES } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface MRFDetail {
  id: string; mrfNumber: string; title: string; status: string;
  vacancyCount: number; justification: string;
  createdAt: string; approvedAt: string | null; rejectedAt: string | null; rejectionReason: string | null;
  country: { name: string }; division: { name: string } | null;
  branch: { name: string } | null; department: { name: string };
  designation: { title: string; requiresPsychometric: boolean } | null;
  createdBy: { name: string; email: string };
  approvalRecords: ApprovalRecord[];
  candidates: CandidateSummary[];
}

interface ApprovalRecord {
  id: string; level: string; approverName: string; status: string;
  notes: string | null; recordedAt: string;
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

// Which MRF pending status each role can act on
const ROLE_TO_PENDING: Record<string, string> = {
  DIVISIONAL_MANAGER: "PENDING_DIVISIONAL",
  FUNCTIONAL_HEAD: "PENDING_FUNCTIONAL",
  COUNTRY_MANAGER: "PENDING_COUNTRY",
};

export default function MRFDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const [mrf, setMrf] = useState<MRFDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvalDialog, setApprovalDialog] = useState<"approve" | "reject" | null>(null);
  const [approverName, setApproverName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdminOrHR = ["ADMIN", "HR"].includes(role);
  const isManagerForThisLevel = mrf ? ROLE_TO_PENDING[role] === mrf.status : false;
  const canAct = (isAdminOrHR || isManagerForThisLevel) && mrf?.status?.startsWith("PENDING");

  const fetchMRF = () => {
    fetch(`/api/mrfs/${id}`)
      .then((r) => r.json())
      .then((data) => { setMrf(data); setLoading(false); });
  };

  useEffect(() => { fetchMRF(); }, [id]);

  const handleApproval = async () => {
    setSubmitting(true);
    await fetch(`/api/mrfs/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: approvalDialog, approverName, notes }),
    });
    setSubmitting(false);
    setApprovalDialog(null);
    setApproverName(""); setNotes("");
    fetchMRF();
  };

  // For manager self-approval, approverName is auto-filled from session
  const isManagerSelfApproval = isManagerForThisLevel && !isAdminOrHR;
  const canSubmitApproval = isManagerSelfApproval ? true : !!approverName;

  if (loading) return <div className="py-20 text-center text-gray-500"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>;
  if (!mrf) return <div className="py-20 text-center text-gray-500">MRF not found.</div>;

  const statusInfo = MRF_STATUSES[mrf.status as keyof typeof MRF_STATUSES];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
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
        {canAct && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setApprovalDialog("reject")} className="text-red-600 border-red-200 hover:bg-red-50">
              <XCircle className="h-4 w-4" /> Reject
            </Button>
            <Button onClick={() => setApprovalDialog("approve")}>
              <CheckCircle className="h-4 w-4" />
              {isManagerSelfApproval ? "Approve" : "Record Approval"}
            </Button>
          </div>
        )}
      </div>

      {/* Manager acting notice */}
      {isManagerSelfApproval && mrf.status.startsWith("PENDING") && (
        <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
          <p className="text-sm font-medium text-orange-800">
            This MRF is awaiting your approval as {role.replace(/_/g, " ")}.
            Your approval will be recorded in your name automatically.
          </p>
        </div>
      )}

      {mrf.status === "REJECTED" && mrf.rejectionReason && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-medium text-red-700">Rejected: {mrf.rejectionReason}</p>
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
              { label: "Vacancies", value: mrf.vacancyCount },
              { label: "Created By", value: mrf.createdBy.name },
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
        <Card>
          <CardHeader><CardTitle>Approval Progress</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {APPROVAL_LEVELS.map((level, idx) => {
                const record = mrf.approvalRecords.find((r) => r.level === level.key);
                const currentPendingStatus = mrf.status;
                const isCurrentLevel = currentPendingStatus === level.pendingStatus;
                const isPastLevel = APPROVAL_LEVELS.findIndex((l) => l.pendingStatus === currentPendingStatus) > idx ||
                  mrf.status === "APPROVED";
                const isApproved = record?.status === "APPROVED";
                const isRejected = record?.status === "REJECTED";
                const isMyLevel = ROLE_TO_PENDING[role] === level.pendingStatus;

                return (
                  <div key={level.key} className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                      ${isApproved ? "bg-green-100 text-green-600" :
                        isRejected ? "bg-red-100 text-red-600" :
                        isCurrentLevel ? (isMyLevel ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600") :
                        "bg-gray-100 text-gray-400"}`}>
                      {isApproved ? <CheckCircle className="h-4 w-4" /> :
                       isRejected ? <XCircle className="h-4 w-4" /> :
                       isCurrentLevel ? <Clock className="h-4 w-4" /> :
                       <span className="text-xs">{idx + 1}</span>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{level.label}</p>
                        {isMyLevel && isCurrentLevel && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 font-medium">Your turn</span>
                        )}
                      </div>
                      {record ? (
                        <>
                          <p className="text-xs text-gray-500">
                            {record.approverName} · {formatDate(record.recordedAt)}
                          </p>
                          {record.notes && <p className="text-xs text-gray-600 mt-0.5 italic">"{record.notes}"</p>}
                        </>
                      ) : isCurrentLevel ? (
                        <p className="text-xs text-blue-500">
                          {isMyLevel ? "Awaiting your approval" : "Awaiting external approval"}
                        </p>
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
          </CardContent>
        </Card>
      </div>

      {/* Candidates Table */}
      {mrf.candidates.length > 0 && (
        <Card>
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

      {/* Approval Dialog */}
      <Dialog open={approvalDialog !== null} onOpenChange={() => setApprovalDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalDialog === "approve" ? "Approve MRF" : "Reject MRF"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isManagerSelfApproval ? (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                Your approval will be recorded as <strong>{session?.user?.name}</strong>.
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                  Approvals happen externally (email / signed document). Use this form to record the external {approvalDialog === "approve" ? "approval" : "rejection"}.
                </div>
                <div className="space-y-2">
                  <Label>Approver Name *</Label>
                  <Input
                    placeholder="Name of person who approved/rejected"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
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
    </div>
  );
}
