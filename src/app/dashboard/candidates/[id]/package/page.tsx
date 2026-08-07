"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { CANDIDATE_STAGES, MRF_STATUSES, formatDate } from "@/lib/utils";

interface PackageData {
  candidate: {
    id: string; firstName: string; lastName: string; email: string; phone: string | null;
    currentStage: string; aiScore: number | null; aiScoreNotes: string | null;
    resumeUrl: string | null; createdAt: string; candidateStatus: string;
    mrf: {
      id: string; referenceNumber: string; mrfNumber: string | null; title: string; status: string;
      vacancyCount: number; ctcRange: string | null; location: string | null;
      jobProfile: string | null;
      department: { name: string };
      orgUnit: { name: string; path: string } | null;
      createdBy: { name: string };
      approvalRecords: { level: string; approverName: string; status: string; notes: string | null; recordedAt: string }[];
    } | null;
    stageHistory: { fromStage: string | null; toStage: string; notes: string | null; changedAt: string }[];
    documents: {
      id: string; name: string; fileUrl: string; documentType: string;
      approvalStatus: string; fileSize: number; createdAt: string;
      uploadedBy: { name: string };
      extractedData: string | null;
    }[];
  };
}

const LEVEL_LABELS: Record<string, string> = {
  DIVISIONAL_MANAGER: "Divisional / Country Manager",
  COUNTRY_SUPERVISOR: "Country Supervisor",
  FUNCTIONAL_HEAD: "Functional Head",
};

export default function CandidatePackagePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PackageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatedAt] = useState(new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" }));

  useEffect(() => {
    fetch(`/api/candidates/${id}`)
      .then((r) => r.json())
      .then((candidate) => {
        setData({ candidate });
        setLoading(false);
      });
  }, [id]);

  if (loading) return (
    <div className="py-20 text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
    </div>
  );
  if (!data) return <div className="py-20 text-center">Candidate not found.</div>;

  const { candidate } = data;
  const stage = CANDIDATE_STAGES.find((s) => s.key === candidate.currentStage);
  const docs = candidate.documents || [];
  const history = candidate.stageHistory || [];
  const approvalRecords = candidate.mrf?.approvalRecords || [];

  return (
    <>
      {/* Screen-only controls */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <Link href={`/dashboard/candidates/${id}/documents`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">Candidate Package</h2>
          <p className="text-sm text-gray-500">{candidate.firstName} {candidate.lastName} · Printable / PDF Export</p>
        </div>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      {/* Printable Package */}
      <div className="max-w-4xl mx-auto bg-white print:max-w-full print:p-0">

        {/* Cover Header */}
        <div className="border-b-4 border-blue-600 pb-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">RecruitPro ERP · Candidate Package</p>
              <h1 className="text-3xl font-bold text-gray-900">{candidate.firstName} {candidate.lastName}</h1>
              <p className="text-gray-600 mt-1">{candidate.email}{candidate.phone ? ` · ${candidate.phone}` : ""}</p>
            </div>
            <div className="text-right">
              <div className="inline-block rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white mb-2">
                {stage?.label || candidate.currentStage}
              </div>
              <p className="text-xs text-gray-400">Generated: {generatedAt}</p>
              {candidate.aiScore != null && (
                <p className="text-xs text-gray-500 mt-1">AI Score: <span className={`font-semibold ${candidate.aiScore >= 70 ? "text-green-600" : "text-orange-600"}`}>{candidate.aiScore.toFixed(1)}%</span></p>
              )}
            </div>
          </div>
          {candidate.aiScoreNotes && (
            <p className="mt-3 text-sm text-gray-600 italic">{candidate.aiScoreNotes}</p>
          )}
        </div>

        {/* Section 1: Candidate Details */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">1. Candidate Information</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div><span className="text-gray-500">Full Name:</span> <span className="font-medium">{candidate.firstName} {candidate.lastName}</span></div>
            <div><span className="text-gray-500">Email:</span> <span className="font-medium">{candidate.email}</span></div>
            <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{candidate.phone || "—"}</span></div>
            <div><span className="text-gray-500">Applied On:</span> <span className="font-medium">{formatDate(candidate.createdAt)}</span></div>
            <div><span className="text-gray-500">Current Stage:</span> <span className="font-medium">{stage?.label || candidate.currentStage}</span></div>
            <div><span className="text-gray-500">Status:</span> <span className="font-medium">{candidate.candidateStatus}</span></div>
            {candidate.resumeUrl && <div className="col-span-2"><span className="text-gray-500">Resume:</span> <a href={candidate.resumeUrl} className="text-blue-600 underline">{candidate.resumeUrl}</a></div>}
          </div>
        </section>

        {/* Section 2: Recruitment Timeline */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">2. Recruitment Timeline</h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No stage history recorded.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
              <div className="space-y-4">
                {history.map((h, i) => {
                  const toStage = CANDIDATE_STAGES.find((s) => s.key === h.toStage);
                  return (
                    <div key={i} className="flex gap-4 pl-8 relative">
                      <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-blue-100 border-2 border-blue-600 flex items-center justify-center text-xs font-bold text-blue-700">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{toStage?.label || h.toStage}</p>
                        <p className="text-xs text-gray-400">{formatDate(h.changedAt)}</p>
                        {h.notes && <p className="text-xs text-gray-600 italic mt-0.5">"{h.notes}"</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Section 3: MRF Details */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">3. Linked MRF Details</h2>
          {!candidate.mrf ? (
            <p className="text-sm text-gray-400 italic">No MRF linked to this candidate.</p>
          ) : (
            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-gray-600">{candidate.mrf.mrfNumber || candidate.mrf.referenceNumber}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${MRF_STATUSES[candidate.mrf.status as keyof typeof MRF_STATUSES]?.color || "bg-gray-100"}`}>
                  {MRF_STATUSES[candidate.mrf.status as keyof typeof MRF_STATUSES]?.label || candidate.mrf.status}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">{candidate.mrf.title}</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <div><span className="text-gray-500">Department:</span> <span className="font-medium">{candidate.mrf.department.name}</span></div>
                <div><span className="text-gray-500">Org Unit:</span> <span className="font-medium">{candidate.mrf.orgUnit?.path || candidate.mrf.orgUnit?.name || "—"}</span></div>
                <div><span className="text-gray-500">Vacancies:</span> <span className="font-medium">{candidate.mrf.vacancyCount}</span></div>
                <div><span className="text-gray-500">CTC Range:</span> <span className="font-medium">{candidate.mrf.ctcRange || "—"}</span></div>
                <div><span className="text-gray-500">Location:</span> <span className="font-medium">{candidate.mrf.location || "—"}</span></div>
                <div><span className="text-gray-500">Raised By:</span> <span className="font-medium">{candidate.mrf.createdBy.name}</span></div>
              </div>
              {candidate.mrf.jobProfile && (
                <div className="text-sm"><span className="text-gray-500">Job Profile:</span><p className="mt-1 text-gray-700">{candidate.mrf.jobProfile}</p></div>
              )}
            </div>
          )}
        </section>

        {/* Section 4: MRF Approval History */}
        {approvalRecords.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">4. MRF Approval History</h2>
            <div className="space-y-3">
              {approvalRecords.map((rec, i) => (
                <div key={i} className="flex items-start gap-4 rounded-lg border border-gray-200 p-3">
                  <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${rec.status === "APPROVED" ? "bg-green-100" : rec.status === "REJECTED" ? "bg-red-100" : "bg-gray-100"}`}>
                    {rec.status === "APPROVED" ? <CheckCircle className="h-4 w-4 text-green-600" /> : rec.status === "REJECTED" ? <XCircle className="h-4 w-4 text-red-600" /> : <Clock className="h-4 w-4 text-gray-400" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{LEVEL_LABELS[rec.level] || rec.level}</p>
                      <p className="text-xs text-gray-400">{formatDate(rec.recordedAt)}</p>
                    </div>
                    <p className="text-xs text-gray-600">{rec.approverName} · {rec.status}</p>
                    {rec.notes && <p className="text-xs text-gray-500 italic mt-0.5">"{rec.notes}"</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 5: Document Index */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">5. Document Index</h2>
          {docs.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No documents uploaded.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">#</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Document</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Uploaded</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc, i) => (
                  <tr key={doc.id} className="even:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 text-gray-500">{i + 1}</td>
                    <td className="border border-gray-200 px-3 py-2">
                      <a href={doc.fileUrl} className="text-blue-600 underline hover:text-blue-800 print:no-underline" target="_blank" rel="noopener noreferrer">
                        {doc.name}
                      </a>
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-600">{doc.documentType}</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-500">{formatDate(doc.createdAt)}</td>
                    <td className="border border-gray-200 px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${doc.approvalStatus === "APPROVED" ? "bg-green-50 text-green-700" : doc.approvalStatus === "REJECTED" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>
                        {doc.approvalStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Section 6: HR Summary */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">6. HR Summary</h2>
          <div className="rounded-lg border border-gray-200 p-4 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{history.length}</p>
                <p className="text-gray-500 text-xs mt-1">Stage Transitions</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{docs.length}</p>
                <p className="text-gray-500 text-xs mt-1">Documents Uploaded</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className={`text-2xl font-bold ${candidate.aiScore != null ? (candidate.aiScore >= 70 ? "text-green-600" : "text-orange-600") : "text-gray-400"}`}>
                  {candidate.aiScore != null ? `${candidate.aiScore.toFixed(0)}%` : "N/A"}
                </p>
                <p className="text-gray-500 text-xs mt-1">AI Score</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                This package was generated from RecruitPro ERP on {generatedAt}.
                All information is confidential and intended for internal HR use only.
              </p>
            </div>
          </div>
        </section>

        {/* Print footer */}
        <div className="hidden print:block mt-8 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">RecruitPro ERP · Candidate Package · {generatedAt} · CONFIDENTIAL</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { font-size: 12px; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>
    </>
  );
}
