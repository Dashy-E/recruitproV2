"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2, CheckCircle, XCircle, Clock, Building2, Users,
  MessageSquare, ExternalLink, ClipboardList,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface MRF {
  id: string;
  referenceNumber: string;
  mrfNumber: string | null;
  title: string;
  status: string;
  vacancyCount: number;
  createdAt: string;
  orgUnit: { name: string; path: string } | null;
  department: { name: string };
  designation: { title: string } | null;
  createdBy: { name: string; email: string };
  approvalRecords: ApprovalRecord[];
  _count: { candidates: number };
  // Server-computed org/department-scoped eligibility for the requesting
  // user — see src/lib/mrf-approval.ts. Don't re-derive this from
  // approvalLevel alone client-side; it needs the org/department checks too.
  canApprove: boolean;
}

interface ApprovalRecord {
  id: string;
  level: string;
  approverName: string;
  approverRole: string | null;
  status: string;
  notes: string | null;
  recordedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_DIVISIONAL: "Pending Divisional/Country Approval",
  PENDING_COUNTRY_SUPERVISOR: "Pending Country Supervisor Approval",
  PENDING_FUNCTIONAL: "Pending Functional Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_DIVISIONAL: "bg-yellow-100 text-yellow-800",
  PENDING_COUNTRY_SUPERVISOR: "bg-blue-100 text-blue-800",
  PENDING_FUNCTIONAL: "bg-orange-100 text-orange-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function ApprovalsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const approvalLevel = (session?.user as { approvalLevel?: string | null })?.approvalLevel ?? null;
  const [mrfs, setMrfs] = useState<MRF[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{ mrf: MRF; action: "approve" | "reject" } | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  // "ANY" is a universal approver (matches the old ADMIN/HR/COUNTRY_MANAGER
  // bypass); other levels only act if the server says they're the genuinely
  // designated (org/department-scoped) approver for that MRF's stage.
  const isUniversalApprover = approvalLevel === "ANY";
  const canActOnMrf = (m: MRF) => isUniversalApprover || m.canApprove;

  const fetchMRFs = () => {
    fetch("/api/mrfs?includeApprovalRecords=1")
      .then((r) => r.json())
      .then((d) => { setMrfs(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => { fetchMRFs(); }, []);

  const ALL_PENDING = ["PENDING_DIVISIONAL", "PENDING_COUNTRY_SUPERVISOR", "PENDING_FUNCTIONAL"];

  const pendingMRFs = mrfs.filter((m) => ALL_PENDING.includes(m.status) && canActOnMrf(m));

  const displayMRFs = filter === "pending" ? pendingMRFs : mrfs.filter((m) => !["DRAFT"].includes(m.status));

  const handleAction = async () => {
    if (!actionDialog) return;
    setSubmitting(true);
    const res = await fetch(`/api/mrfs/${actionDialog.mrf.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionDialog.action, notes }),
    });
    setSubmitting(false);
    if (res.ok) {
      setActionDialog(null);
      setNotes("");
      fetchMRFs();
    } else {
      const data = await res.json();
      alert(data.error || "Action failed.");
    }
  };

  if (loading) {
    return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  if (!approvalLevel) {
    return (
      <div className="py-20 text-center text-gray-500">
        <ClipboardList className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <p>You do not have access to the approvals portal.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Approval Portal</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isUniversalApprover
              ? "Admin/HR view — all pending MRFs across all levels"
              : `Logged in as ${role.replace(/_/g, " ")} — showing MRFs at your approval level`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === "pending" ? "default" : "outline"} size="sm" onClick={() => setFilter("pending")}>
            Pending ({pendingMRFs.length})
          </Button>
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            All MRFs
          </Button>
        </div>
      </div>

      {displayMRFs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <CheckCircle className="mx-auto h-12 w-12 text-green-300 mb-3" />
            <p className="font-medium">No pending approvals</p>
            <p className="text-sm mt-1">All MRFs at your level have been actioned.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {displayMRFs.map((mrf) => {
            const canAct = ALL_PENDING.includes(mrf.status) && canActOnMrf(mrf);

            return (
              <Card key={mrf.id} className={`border-l-4 ${canAct ? "border-l-blue-500" : "border-l-gray-200"}`}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-gray-500">{mrf.mrfNumber || mrf.referenceNumber}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[mrf.status] || "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[mrf.status] || mrf.status}
                        </span>
                        {canAct && (
                          <span className="rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs px-2 py-0.5 font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Action Required
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-base mt-1">{mrf.title}</CardTitle>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {mrf.orgUnit?.path || mrf.orgUnit?.name || "—"}
                        </span>
                        <span>{mrf.department.name}{mrf.designation ? ` · ${mrf.designation.title}` : ""}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {mrf.vacancyCount} vacancies
                        </span>
                        <span>{mrf._count.candidates} candidate(s)</span>
                        <span>Submitted by {mrf.createdBy.name} · {formatDate(mrf.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Link href={`/dashboard/mrfs/${mrf.id}`} target="_blank">
                        <Button variant="ghost" size="sm" className="text-xs">
                          <ExternalLink className="h-3 w-3 mr-1" /> View MRF
                        </Button>
                      </Link>
                      {canAct && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white text-xs"
                            onClick={() => { setNotes(""); setActionDialog({ mrf, action: "approve" }); }}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                            onClick={() => { setNotes(""); setActionDialog({ mrf, action: "reject" }); }}
                          >
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* Approval History */}
                {mrf.approvalRecords.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="border-t pt-3 mt-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Approval History
                      </p>
                      <div className="space-y-2">
                        {[...mrf.approvalRecords].reverse().map((rec) => (
                          <div key={rec.id} className="flex items-start gap-3 text-xs">
                            <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0
                              ${rec.status === "APPROVED" ? "bg-green-100" : rec.status === "REJECTED" ? "bg-red-100" : "bg-gray-100"}`}>
                              {rec.status === "APPROVED" ? <CheckCircle className="h-3 w-3 text-green-600" /> :
                               rec.status === "REJECTED" ? <XCircle className="h-3 w-3 text-red-600" /> :
                               <Clock className="h-3 w-3 text-gray-400" />}
                            </div>
                            <div className="flex-1">
                              <span className="font-medium text-gray-800">{rec.approverName}</span>
                              {rec.approverRole && <span className="text-gray-400 ml-1">({rec.approverRole.replace(/_/g, " ")})</span>}
                              <span className={`ml-2 font-medium ${rec.status === "APPROVED" ? "text-green-600" : "text-red-600"}`}>
                                {rec.status}
                              </span>
                              <span className="text-gray-400 ml-2">{rec.level.replace(/_/g, " ")}</span>
                              <span className="text-gray-400 ml-2">· {formatDate(rec.recordedAt)}</span>
                              {rec.notes && <p className="text-gray-500 italic mt-0.5">"{rec.notes}"</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Approve / Reject Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => !o && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "approve" ? "Approve MRF" : "Reject MRF"}
            </DialogTitle>
            {actionDialog && (
              <p className="text-sm text-gray-500 mt-1">
                {actionDialog.mrf.mrfNumber || actionDialog.mrf.referenceNumber} — {actionDialog.mrf.title}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                {actionDialog?.action === "approve" ? "Comments (optional)" : "Reason for Rejection *"}
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  actionDialog?.action === "approve"
                    ? "Add any comments or conditions…"
                    : "Please state the reason for rejection…"
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button
              onClick={handleAction}
              disabled={submitting || (actionDialog?.action === "reject" && !notes.trim())}
              className={actionDialog?.action === "approve" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {actionDialog?.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
