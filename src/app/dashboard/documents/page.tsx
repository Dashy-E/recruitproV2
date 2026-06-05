"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FolderOpen, FileText, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
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
  candidate: { firstName: string; lastName: string } | null;
  mrf: { mrfNumber: string; title: string } | null;
}

const DOC_TYPE_COLORS: Record<string, string> = {
  IDENTIFICATION: "bg-blue-100 text-blue-700",
  RECRUITMENT: "bg-purple-100 text-purple-700",
  MRF_APPROVAL: "bg-green-100 text-green-700",
  ONBOARDING: "bg-orange-100 text-orange-700",
  OTHER: "bg-gray-100 text-gray-600",
};

const APPROVAL_INFO: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  PENDING: { label: "Pending", icon: Clock, cls: "text-yellow-600 bg-yellow-50" },
  APPROVED: { label: "Approved", icon: CheckCircle, cls: "text-green-600 bg-green-50" },
  REJECTED: { label: "Rejected", icon: XCircle, cls: "text-red-600 bg-red-50" },
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");

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

  const docsByType = documents.reduce<Record<string, number>>((acc, d) => {
    acc[d.documentType] = (acc[d.documentType] || 0) + 1;
    return acc;
  }, {});

  const pendingCount = documents.filter((d) => d.approvalStatus === "PENDING").length;
  const filtered = filter === "ALL" ? documents : documents.filter((d) => d.approvalStatus === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Document Management</h2>
          <p className="text-sm text-gray-500 mt-1">{documents.length} documents · {pendingCount} pending review</p>
        </div>
        <div className="flex gap-2">
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
              {f === "PENDING" && pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-yellow-500 text-white text-xs px-1.5">{pendingCount}</span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Type Summary */}
      <div className="flex flex-wrap gap-3">
        {["MRF_APPROVAL", "IDENTIFICATION", "RECRUITMENT", "ONBOARDING", "OTHER"].map((type) => (
          <div key={type} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${DOC_TYPE_COLORS[type]}`}>
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">{type.replace(/_/g, " ")}</span>
            <span className="font-bold">{docsByType[type] || 0}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <FolderOpen className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p>No documents {filter !== "ALL" ? `with status "${filter}"` : "uploaded yet"}.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((doc) => {
                  const info = APPROVAL_INFO[doc.approvalStatus] || APPROVAL_INFO.PENDING;
                  const Icon = info.icon;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline">
                          {doc.name}
                        </a>
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DOC_TYPE_COLORS[doc.documentType]}`}>
                          {doc.documentType.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {doc.candidate
                          ? <span className="text-purple-600">{doc.candidate.firstName} {doc.candidate.lastName}</span>
                          : doc.mrf
                          ? <span className="text-blue-600">{doc.mrf.mrfNumber}</span>
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{doc.uploadedBy.name}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {doc.fileSize > 1024 * 1024
                          ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`
                          : `${Math.round(doc.fileSize / 1024)} KB`}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{formatDate(doc.createdAt)}</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium w-fit ${info.cls}`}>
                          <Icon className="h-3 w-3" />
                          {info.label}
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.approvalStatus === "PENDING" ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-green-600 hover:text-green-700 text-xs px-2"
                              disabled={!!actionLoading}
                              onClick={() => handleApproval(doc.id, "APPROVED")}
                            >
                              {actionLoading === doc.id + "APPROVED"
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <CheckCircle className="h-3 w-3" />}
                              Approve
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-red-600 hover:text-red-700 text-xs px-2"
                              disabled={!!actionLoading}
                              onClick={() => handleApproval(doc.id, "REJECTED")}
                            >
                              {actionLoading === doc.id + "REJECTED"
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <XCircle className="h-3 w-3" />}
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
