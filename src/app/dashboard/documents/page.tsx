"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, FileText, CheckCircle, XCircle, Clock, Loader2, User, ChevronDown, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Document {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  documentType: string;
  approvalStatus: string;
  approvalNotes: string | null;
  createdAt: string;
  uploadedBy: { name: string };
  candidate: { id: string; firstName: string; lastName: string } | null;
  mrf: { mrfNumber: string; title: string } | null;
}

type CandidateGroup = {
  candidateId: string | null;
  candidateName: string;
  documents: Document[];
};

const STATUS_INFO: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  PENDING: { label: "Pending", icon: Clock, cls: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  APPROVED: { label: "Approved", icon: CheckCircle, cls: "text-green-600 bg-green-50 border-green-200" },
  REJECTED: { label: "Rejected", icon: XCircle, cls: "text-red-600 bg-red-50 border-red-200" },
};

const DOC_TYPE_COLORS: Record<string, string> = {
  RESUME: "bg-blue-100 text-blue-700",
  OFFER_LETTER: "bg-purple-100 text-purple-700",
  APPOINTMENT_LETTER: "bg-indigo-100 text-indigo-700",
  AGREEMENT: "bg-green-100 text-green-700",
  ID_PROOF: "bg-orange-100 text-orange-700",
  ADDRESS_PROOF: "bg-yellow-100 text-yellow-700",
  ONBOARDING: "bg-teal-100 text-teal-700",
  OTHER: "bg-gray-100 text-gray-600",
};

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchDocs = () => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((d) => { setDocuments(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleApproval = async (id: string, approvalStatus: string) => {
    setActionLoading(id + approvalStatus);
    await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus }),
    });
    setActionLoading(null);
    fetchDocs();
  };

  const filtered = filter === "ALL" ? documents : documents.filter((d) => d.approvalStatus === filter);

  // Group by candidate
  const groups: CandidateGroup[] = [];
  const groupMap: Record<string, CandidateGroup> = {};
  for (const doc of filtered) {
    const key = doc.candidate ? doc.candidate.id : "__mrf__";
    const name = doc.candidate
      ? `${doc.candidate.firstName} ${doc.candidate.lastName}`
      : doc.mrf
      ? `MRF: ${doc.mrf.mrfNumber} — ${doc.mrf.title}`
      : "Unlinked Documents";
    if (!groupMap[key]) {
      groupMap[key] = { candidateId: doc.candidate?.id ?? null, candidateName: name, documents: [] };
      groups.push(groupMap[key]);
    }
    groupMap[key].documents.push(doc);
  }

  const pendingCount = documents.filter((d) => d.approvalStatus === "PENDING").length;
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const filterTabs: { key: "ALL" | "PENDING" | "APPROVED" | "REJECTED"; label: string; count?: number }[] = [
    { key: "ALL", label: "All", count: documents.length },
    { key: "PENDING", label: "Pending Review", count: documents.filter((d) => d.approvalStatus === "PENDING").length },
    { key: "APPROVED", label: "Approved", count: documents.filter((d) => d.approvalStatus === "APPROVED").length },
    { key: "REJECTED", label: "Rejected", count: documents.filter((d) => d.approvalStatus === "REJECTED").length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
          <p className="text-sm text-gray-500 mt-1">
            {documents.length} total{pendingCount > 0 ? ` · ${pendingCount} pending review` : ""}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b pb-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-t text-sm font-medium transition-colors border-b-2 -mb-[1px]
              ${filter === tab.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${filter === tab.key ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>
      ) : groups.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          <FolderOpen className="mx-auto h-12 w-12 mb-3 opacity-40" />
          <p>No documents found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const key = group.candidateId ?? "__mrf__";
            const isOpen = expanded[key] !== false; // default open
            const groupPending = group.documents.filter((d) => d.approvalStatus === "PENDING").length;

            return (
              <Card key={key} className="overflow-hidden">
                {/* Candidate header row */}
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggle(key)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 shrink-0">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {group.candidateId ? (
                          <Link
                            href={`/dashboard/candidates/${group.candidateId}`}
                            className="font-semibold text-gray-900 hover:text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {group.candidateName}
                          </Link>
                        ) : (
                          <span className="font-semibold text-gray-900">{group.candidateName}</span>
                        )}
                        <Badge variant="secondary" className="text-xs">{group.documents.length} doc{group.documents.length !== 1 ? "s" : ""}</Badge>
                        {groupPending > 0 && (
                          <span className="rounded-full bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 font-medium">
                            {groupPending} pending
                          </span>
                        )}
                      </div>
                    </div>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                  </div>
                </CardHeader>

                {isOpen && (
                  <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                      {group.documents.map((doc) => {
                        const info = STATUS_INFO[doc.approvalStatus] || STATUS_INFO.PENDING;
                        const StatusIcon = info.icon;
                        const typeColor = DOC_TYPE_COLORS[doc.documentType] || DOC_TYPE_COLORS.OTHER;

                        return (
                          <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                            <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              {/* Document Type → filename */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${typeColor}`}>
                                  {doc.documentType.replace(/_/g, " ")}
                                </span>
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:underline truncate"
                                >
                                  {doc.name}
                                </a>
                              </div>
                              {/* Upload date · size · uploader */}
                              <p className="text-xs text-gray-400 mt-0.5">
                                {formatDate(doc.createdAt)} · {fileSize(doc.fileSize)} · by {doc.uploadedBy.name}
                              </p>
                              {doc.approvalNotes && (
                                <p className="text-xs text-gray-500 italic mt-0.5">"{doc.approvalNotes}"</p>
                              )}
                            </div>

                            {/* Status badge */}
                            <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${info.cls}`}>
                              <StatusIcon className="h-3 w-3" />
                              {info.label}
                            </div>

                            {/* Approve / Reject actions */}
                            {doc.approvalStatus === "PENDING" && (
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-7 text-green-600 hover:bg-green-50 text-xs px-2"
                                  disabled={actionLoading === doc.id + "APPROVED"}
                                  onClick={() => handleApproval(doc.id, "APPROVED")}
                                >
                                  {actionLoading === doc.id + "APPROVED" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                                </Button>
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-7 text-red-600 hover:bg-red-50 text-xs px-2"
                                  disabled={actionLoading === doc.id + "REJECTED"}
                                  onClick={() => handleApproval(doc.id, "REJECTED")}
                                >
                                  {actionLoading === doc.id + "REJECTED" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reject"}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
