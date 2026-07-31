"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, FileText, Upload, Download, Eye, RefreshCw,
  CheckCircle, XCircle, Clock, Package, Loader2, FolderOpen,
  User, Briefcase, GraduationCap, CreditCard, FileCheck, MoreHorizontal
} from "lucide-react";
import { formatDate, CANDIDATE_STAGES } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface Document {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  documentType: string;
  category: string | null;
  version: number;
  approvalStatus: string;
  approvalNotes: string | null;
  extractedData: string | null;
  createdAt: string;
  uploadedBy: { name: string };
}

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  currentStage: string;
  aiScore: number | null;
  createdAt: string;
  mrf: {
    id: string;
    referenceNumber: string;
    mrfNumber: string | null;
    title: string;
    department: { name: string };
    branch: { name: string } | null;
    country: { name: string };
  } | null;
}

const DOC_CATEGORIES: {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  types: string[];
}[] = [
  {
    key: "identity",
    label: "Identity Documents",
    icon: CreditCard,
    color: "text-blue-600",
    types: ["AADHAAR", "PAN", "PASSPORT", "ID_PROOF"],
  },
  {
    key: "resume",
    label: "Resume & Profile",
    icon: User,
    color: "text-purple-600",
    types: ["RESUME", "COVER_LETTER"],
  },
  {
    key: "education",
    label: "Education",
    icon: GraduationCap,
    color: "text-green-600",
    types: ["QUALIFICATION_DOCS", "DEGREE_CERTIFICATE", "MARKSHEET"],
  },
  {
    key: "employment",
    label: "Employment",
    icon: Briefcase,
    color: "text-orange-600",
    types: ["EXPERIENCE_LETTER", "RELIEVING_LETTER", "SALARY_SLIP"],
  },
  {
    key: "bank",
    label: "Bank & Finance",
    icon: FileCheck,
    color: "text-teal-600",
    types: ["BANK_DETAILS"],
  },
  {
    key: "other",
    label: "Other Documents",
    icon: FolderOpen,
    color: "text-gray-600",
    types: ["OTHERS", "OTHER", "RECRUITMENT", "ONBOARDING", "APPOINTMENT_LETTER", "OFFER_LETTER", "AGREEMENT"],
  },
];

const STATUS_CONFIG = {
  APPROVED: { label: "Approved", icon: CheckCircle, cls: "text-green-700 bg-green-50 border-green-200" },
  PENDING: { label: "Pending", icon: Clock, cls: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  REJECTED: { label: "Rejected", icon: XCircle, cls: "text-red-700 bg-red-50 border-red-200" },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function CandidateDocumentCenter() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const isAdminOrHR = ["ADMIN", "HR"].includes(role);

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("RECRUITMENT");
  const [replaceDialog, setReplaceDialog] = useState<Document | null>(null);
  const [expandedExtracted, setExpandedExtracted] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const fetchAll = () => {
    Promise.all([
      fetch(`/api/candidates/${id}`).then((r) => r.json()),
      fetch(`/api/documents?candidateId=${id}`).then((r) => r.json()),
    ]).then(([cand, docs]) => {
      setCandidate(cand);
      setDocuments(Array.isArray(docs) ? docs : []);
      setLoading(false);
    });
  };

  useEffect(() => { fetchAll(); }, [id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("documentType", uploadCategory);
    fd.append("candidateId", id);
    await fetch("/api/documents", { method: "POST", body: fd });
    setUploading(false);
    fetchAll();
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceDialog) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("documentType", replaceDialog.documentType);
    fd.append("candidateId", id);
    fd.append("replacesDocumentId", replaceDialog.id);
    await fetch("/api/documents", { method: "POST", body: fd });
    setUploading(false);
    setReplaceDialog(null);
    fetchAll();
    if (replaceRef.current) replaceRef.current.value = "";
  };

  const handleApproval = async (docId: string, action: "APPROVED" | "REJECTED") => {
    await fetch(`/api/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus: action }),
    });
    fetchAll();
  };

  if (loading) return (
    <div className="py-20 text-center text-gray-500">
      <Loader2 className="mx-auto h-8 w-8 animate-spin" />
    </div>
  );
  if (!candidate) return <div className="py-20 text-center text-gray-500">Candidate not found.</div>;

  const stage = CANDIDATE_STAGES.find((s) => s.key === candidate.currentStage);
  const filteredDocs = search
    ? documents.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.documentType.toLowerCase().includes(search.toLowerCase()))
    : documents;

  const getCategoryDocs = (types: string[]) =>
    filteredDocs.filter((d) => types.includes(d.documentType) || types.includes(d.documentType?.toUpperCase()));

  const totalDocs = documents.length;
  const approvedCount = documents.filter((d) => d.approvalStatus === "APPROVED").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/candidates/${id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">Document Center</h2>
          <p className="text-sm text-gray-500">{candidate.firstName} {candidate.lastName}</p>
        </div>
        <Link href={`/dashboard/candidates/${id}/package`}>
          <Button className="gap-2">
            <Package className="h-4 w-4" />
            Generate Candidate Package
          </Button>
        </Link>
      </div>

      {/* Candidate Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">
                {candidate.firstName[0]}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{candidate.firstName} {candidate.lastName}</p>
                <p className="text-xs text-gray-500">{candidate.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 space-y-1 text-sm">
            <p className="text-gray-500">Current Stage</p>
            <Badge variant="default">{stage?.label || candidate.currentStage}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 space-y-1 text-sm">
            <p className="text-gray-500">Documents</p>
            <p className="font-semibold text-gray-900">{totalDocs} total · <span className="text-green-600">{approvedCount} approved</span></p>
            <div className="h-1.5 w-full rounded-full bg-gray-100">
              <div className="h-1.5 rounded-full bg-green-500 transition-all" style={{ width: totalDocs ? `${(approvedCount / totalDocs) * 100}%` : "0%" }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Bar */}
      {isAdminOrHR && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger className="h-9 w-48">
                    <SelectValue placeholder="Document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESUME">Resume</SelectItem>
                    <SelectItem value="AADHAAR">Aadhaar</SelectItem>
                    <SelectItem value="PAN">PAN Card</SelectItem>
                    <SelectItem value="PASSPORT">Passport</SelectItem>
                    <SelectItem value="QUALIFICATION_DOCS">Qualification Docs</SelectItem>
                    <SelectItem value="EXPERIENCE_LETTER">Experience Letter</SelectItem>
                    <SelectItem value="RELIEVING_LETTER">Relieving Letter</SelectItem>
                    <SelectItem value="BANK_DETAILS">Bank Details</SelectItem>
                    <SelectItem value="RECRUITMENT">Recruitment Doc</SelectItem>
                    <SelectItem value="OTHERS">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload Document
              </Button>
              <input
                type="text"
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-md border border-gray-200 px-3 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Categories */}
      <div className="space-y-4">
        {DOC_CATEGORIES.map((cat) => {
          const catDocs = getCategoryDocs(cat.types);
          const Icon = cat.icon;
          if (catDocs.length === 0) return null;
          return (
            <Card key={cat.key}>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${cat.color}`} />
                  {cat.label}
                  <span className="ml-auto text-sm font-normal text-gray-400">{catDocs.length} file{catDocs.length !== 1 ? "s" : ""}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="divide-y divide-gray-100">
                  {catDocs.map((doc) => {
                    const StatusIcon = STATUS_CONFIG[doc.approvalStatus as keyof typeof STATUS_CONFIG]?.icon || Clock;
                    const statusCls = STATUS_CONFIG[doc.approvalStatus as keyof typeof STATUS_CONFIG]?.cls || "";
                    const extractedFields = (() => {
                      try { return doc.extractedData ? Object.entries(JSON.parse(doc.extractedData)) : []; }
                      catch { return []; }
                    })();

                    return (
                      <div key={doc.id} className="py-3">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                            <p className="text-xs text-gray-400">
                              {formatSize(doc.fileSize)} · {formatDate(doc.createdAt)} · {doc.uploadedBy?.name || "Unknown"}
                              {doc.version > 1 && <span className="ml-2 text-blue-500">v{doc.version}</span>}
                            </p>
                          </div>
                          <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusCls}`}>
                            <StatusIcon className="h-3 w-3" />
                            {STATUS_CONFIG[doc.approvalStatus as keyof typeof STATUS_CONFIG]?.label || doc.approvalStatus}
                          </div>
                          <div className="flex items-center gap-1">
                            {extractedFields.length > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-blue-600"
                                onClick={() => setExpandedExtracted(expandedExtracted === doc.id ? null : doc.id)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 px-2">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                            {isAdminOrHR && (
                              <>
                                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setReplaceDialog(doc)}>
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                                {doc.approvalStatus === "PENDING" && (
                                  <>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600" onClick={() => handleApproval(doc.id, "APPROVED")}>
                                      <CheckCircle className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600" onClick={() => handleApproval(doc.id, "REJECTED")}>
                                      <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Extracted Data */}
                        {expandedExtracted === doc.id && extractedFields.length > 0 && (
                          <div className="mt-2 ml-8 rounded-lg bg-blue-50 border border-blue-100 p-3">
                            <p className="text-xs font-semibold text-blue-700 mb-1.5">Extracted Data</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              {extractedFields.map(([k, v]) => (
                                <div key={k} className="text-xs">
                                  <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}: </span>
                                  <span className="font-medium text-gray-800">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {doc.approvalNotes && (
                          <p className="mt-1 ml-8 text-xs text-gray-500 italic">Note: {doc.approvalNotes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredDocs.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
            <FolderOpen className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No documents yet</p>
            <p className="text-gray-400 text-sm mt-1">Upload documents using the button above</p>
          </div>
        )}
      </div>

      {/* Replace Dialog */}
      <Dialog open={!!replaceDialog} onOpenChange={() => setReplaceDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Replace Document</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-sm text-gray-600">
              Replacing: <span className="font-medium">{replaceDialog?.name}</span>
            </p>
            <p className="text-xs text-gray-400">The existing document will be kept as a previous version.</p>
            <input ref={replaceRef} type="file" className="hidden" onChange={handleReplace} />
            <Button className="w-full" onClick={() => replaceRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Choose Replacement File
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceDialog(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
