"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle, FileText, ChevronRight, UserCheck } from "lucide-react";
import { CANDIDATE_STAGES, formatDate } from "@/lib/utils";

interface Employee {
  id: string;
  employeeCode: string;
  joiningDate: string;
  department: string | null;
  designation: string | null;
  ctc: number | null;
  reportingTo: string | null;
  onboardingStep: number;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    currentStage: string;
    mrf: { title: string; department: { name: string } } | null;
  };
}

interface Document {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  createdAt: string;
}

const ONBOARDING_FORM_FIELDS = [
  { key: "emergencyContact", label: "Emergency Contact Name", type: "text", required: true },
  { key: "emergencyPhone", label: "Emergency Contact Phone", type: "tel", required: true },
  { key: "bankAccount", label: "Bank Account Number", type: "text", required: true },
  { key: "bankName", label: "Bank Name", type: "text", required: true },
  { key: "ifsc", label: "IFSC Code", type: "text", required: true },
  { key: "pan", label: "PAN Number", type: "text", required: true },
  { key: "aadhaar", label: "Aadhaar Number (last 4 digits)", type: "text", required: true },
  { key: "permanentAddress", label: "Permanent Address", type: "text", required: false },
  { key: "bloodGroup", label: "Blood Group", type: "text", required: false },
];

const POST_JOIN_STAGES = CANDIDATE_STAGES.filter((s) => s.step >= 11);

export default function EmployeePortalPage() {
  const { data: session } = useSession();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submittingForm, setSubmittingForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userId = (session?.user as { id?: string })?.id;

  const fetchEmployee = async () => {
    const res = await fetch("/api/employees/me");
    if (res.ok) {
      const data = await res.json();
      setEmployee(data.employee);
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
    }
    setLoading(false);
  };

  useEffect(() => { if (session) fetchEmployee(); }, [session]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("candidateId", employee.candidate.id);
    fd.append("documentType", "ONBOARDING");
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    if (res.ok) {
      await fetchEmployee();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const advanceStep = async (nextStep: number) => {
    if (!employee) return;
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingStep: nextStep }),
    });
    if (res.ok) {
      setEmployee((prev) => prev ? { ...prev, onboardingStep: nextStep } : prev);
    }
  };

  const handleFormSubmit = async () => {
    setSubmittingForm(true);
    await advanceStep(2);
    setSubmittingForm(false);
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="py-20 text-center text-gray-500">
        <UserCheck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <p className="font-medium">Your employee profile is being set up.</p>
        <p className="text-sm mt-1">Please check back shortly or contact HR.</p>
      </div>
    );
  }

  const step = employee.onboardingStep;

  const STEPS = [
    { label: "Upload Documents", icon: Upload },
    { label: "Onboarding Form", icon: FileText },
    { label: "Employee Dashboard", icon: UserCheck },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="rounded-lg bg-teal-600 p-6 text-white">
        <h2 className="text-2xl font-bold">Welcome, {session?.user?.name}!</h2>
        <p className="mt-1 text-teal-100">
          Employee Portal — {employee.employeeCode}
          {employee.designation ? ` · ${employee.designation}` : ""}
          {employee.department ? ` · ${employee.department}` : ""}
        </p>
      </div>

      {/* Step progress */}
      {step < 2 && (
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium
                  ${done ? "bg-green-100 text-green-700" : current ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                  {done ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  {s.label}
                </div>
                {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Step 0: Document Upload */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-teal-600" />
              Step 1 — Upload Onboarding Documents
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Please upload all required documents (ID proof, address proof, certificates, etc.).
              Once you have uploaded your documents, click Continue to proceed.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {documents.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Uploaded ({documents.length})</p>
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-md border bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{doc.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(doc.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? "Uploading…" : "Upload Document"}
              </Button>
              <span className="text-xs text-gray-400">PDF, DOC, JPG, PNG accepted</span>
            </div>

            <div className="pt-2 border-t">
              <Button
                onClick={() => advanceStep(1)}
                disabled={documents.length === 0}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                Continue to Onboarding Form
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              {documents.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">Upload at least one document to continue.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Onboarding Form */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600" />
              Step 2 — Onboarding Information Form
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Please fill in your personal and banking details for HR records.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ONBOARDING_FORM_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-sm">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                  <Input
                    type={field.type}
                    value={formData[field.key] || ""}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    placeholder={field.label}
                  />
                </div>
              ))}
            </div>

            <div className="pt-2 border-t flex gap-3">
              <Button
                onClick={handleFormSubmit}
                disabled={submittingForm || ONBOARDING_FORM_FIELDS.filter((f) => f.required).some((f) => !formData[f.key]?.trim())}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {submittingForm && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Submit Form & View Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Employee Dashboard */}
      {step >= 2 && (
        <div className="space-y-4">
          {/* Employee Details */}
          <Card>
            <CardHeader><CardTitle>Your Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Employee Code", employee.employeeCode],
                ["Department", employee.department || "—"],
                ["Designation", employee.designation || "—"],
                ["Joining Date", formatDate(employee.joiningDate)],
                ["Reporting To", employee.reportingTo || "—"],
                ["CTC", employee.ctc ? `₹${employee.ctc.toLocaleString("en-IN")}` : "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-gray-500 text-xs">{label}</p>
                  <p className="font-medium">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Post-join Pipeline */}
          <Card>
            <CardHeader>
              <CardTitle>Your Onboarding Pipeline</CardTitle>
              <p className="text-sm text-gray-500">Track your progress through the post-joining stages.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {POST_JOIN_STAGES.map((stage) => {
                  const currentIdx = CANDIDATE_STAGES.findIndex((s) => s.key === employee.candidate.currentStage);
                  const stageIdx = CANDIDATE_STAGES.findIndex((s) => s.key === stage.key);
                  const status = stageIdx < currentIdx ? "completed" : stageIdx === currentIdx ? "current" : "pending";
                  return (
                    <div key={stage.key} className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium shrink-0
                        ${status === "completed" ? "bg-green-100 text-green-700" :
                          status === "current" ? "bg-teal-600 text-white" :
                          "bg-gray-100 text-gray-400"}`}>
                        {status === "completed" ? "✓" : stage.step - 10}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${status === "current" ? "text-teal-700" : status === "completed" ? "text-gray-700" : "text-gray-400"}`}>
                          {stage.label}
                        </p>
                        {status === "current" && (
                          <Badge variant="outline" className="text-xs border-teal-400 text-teal-700 mt-0.5">Current Stage</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Uploaded Documents */}
          {documents.length > 0 && (
            <Card>
              <CardHeader><CardTitle>My Documents</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-md border bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        {doc.name}
                      </a>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(doc.createdAt)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
