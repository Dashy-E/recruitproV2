"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Upload, CheckCircle, FileText, UserCheck, Plus, Trash2,
  ChevronDown, ChevronUp, Globe, MapPin,
} from "lucide-react";
import { CANDIDATE_STAGES, formatDate } from "@/lib/utils";

// Document checklist per employee type
const INDIA_CHECKLIST = [
  { key: "AADHAAR", label: "Aadhaar Card", required: true },
  { key: "PAN", label: "PAN Card", required: true },
  { key: "QUALIFICATION", label: "Qualification Documents", required: true },
  { key: "BANK_DETAILS", label: "Bank Details Document", required: true },
  { key: "OTHERS", label: "Other Documents", required: false },
];
const OVERSEAS_CHECKLIST = [
  { key: "PASSPORT", label: "Passport / Government-Issued ID", required: true },
  { key: "QUALIFICATION", label: "Qualification Documents", required: true },
  { key: "BANK_DETAILS", label: "Bank Details Document", required: true },
  { key: "OTHERS", label: "Other Documents", required: false },
];

interface Employee {
  id: string;
  employeeCode: string;
  joiningDate: string;
  department: string | null;
  designation: string | null;
  ctc: number | null;
  reportingTo: string | null;
  onboardingStep: number;
  employeeType: string;
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
  documentType: string;
  createdAt: string;
  approvalStatus: string;
  extractedData: string | null;
}

interface EducationRow { institute: string; exam: string; year: string; percentage: string }
interface EmploymentRow { employer: string; from: string; to: string; role: string; lastCTC: string }

type FormData = {
  // Personal Identity
  salutation: string; firstName: string; middleName: string; lastName: string;
  fatherFirstName: string; fatherLastName: string;
  // Personal Details
  dateOfBirth: string; dateOfJoining: string; gender: string; maritalStatus: string;
  religion: string; bloodGroup: string;
  // Family Info
  hasChildren: string; hasSpouse: string; spouseDateOfBirth: string;
  // Present Address
  presentAddress: string; presentPinCode: string; presentMobile: string; presentEmail: string;
  // Permanent Address
  permanentAddress: string; permanentPinCode: string; permanentMobile: string;
  // Bank Details
  bankName: string; bankBranchName: string; bankAccountNumber: string; ifscCode: string; employeeNameAsPerBank: string;
  // Identity Docs
  aadhaarNumber: string; panNumber: string; passportNumber: string; esicNumber: string;
  // Emergency Contact
  emergencyName: string; emergencyRelationship: string; emergencyMobile: string;
  // Compliance Declarations
  everConvicted: string; everConvictedDetails: string;
  drugAlcoholTreatment: string; drugAlcoholDetails: string;
  preExistingConditions: string; preExistingDetails: string;
  physicalDefect: string; physicalDefectDetails: string;
  // Career Objective
  careerObjective: string;
  // Declaration
  declarationDate: string;
};

const EMPTY_FORM: FormData = {
  salutation: "", firstName: "", middleName: "", lastName: "",
  fatherFirstName: "", fatherLastName: "",
  dateOfBirth: "", dateOfJoining: "", gender: "", maritalStatus: "",
  religion: "", bloodGroup: "",
  hasChildren: "", hasSpouse: "", spouseDateOfBirth: "",
  presentAddress: "", presentPinCode: "", presentMobile: "", presentEmail: "",
  permanentAddress: "", permanentPinCode: "", permanentMobile: "",
  bankName: "", bankBranchName: "", bankAccountNumber: "", ifscCode: "", employeeNameAsPerBank: "",
  aadhaarNumber: "", panNumber: "", passportNumber: "", esicNumber: "",
  emergencyName: "", emergencyRelationship: "", emergencyMobile: "",
  everConvicted: "", everConvictedDetails: "",
  drugAlcoholTreatment: "", drugAlcoholDetails: "",
  preExistingConditions: "", preExistingDetails: "",
  physicalDefect: "", physicalDefectDetails: "",
  careerObjective: "",
  declarationDate: "",
};

const POST_JOIN_STAGES = CANDIDATE_STAGES.filter((s) => s.step >= 11);

export default function EmployeePortalPage() {
  const { data: session } = useSession();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [selectedEmpType, setSelectedEmpType] = useState<"INDIA" | "OVERSEAS" | null>(null);
  const [savingType, setSavingType] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; description: string | null; templateType: string; fileUrl: string }[]>([]);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [education, setEducation] = useState<EducationRow[]>([{ institute: "", exam: "", year: "", percentage: "" }]);
  const [employment, setEmployment] = useState<EmploymentRow[]>([{ employer: "", from: "", to: "", role: "", lastCTC: "" }]);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [formSaved, setFormSaved] = useState(false);
  const [formSaveError, setFormSaveError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadKey, setPendingUploadKey] = useState<string | null>(null);

  const fetchEmployee = async () => {
    const res = await fetch("/api/employees/me");
    if (res.ok) {
      const data = await res.json();
      setEmployee(data.employee);
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
      if (data.employee?.employeeType) {
        setSelectedEmpType(data.employee.employeeType as "INDIA" | "OVERSEAS");
      }
      if (data.employee) {
        const dr = await fetch(`/api/employees/${data.employee.id}/onboarding-data`);
        if (dr.ok) {
          const saved = await dr.json();
          if (saved && saved.formData) {
            const parsed = saved.formData;
            if (parsed.formData) setFormData(parsed.formData);
            if (parsed.education) setEducation(parsed.education);
            if (parsed.employment) setEmployment(parsed.employment);
            setFormSaved(true);
          }
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (session) {
      fetchEmployee();
      fetch("/api/document-templates").then((r) => r.json()).then((d) => setTemplates(Array.isArray(d) ? d : []));
    }
  }, [session]);

  const handleSaveType = async (type: "INDIA" | "OVERSEAS") => {
    if (!employee) return;
    setSavingType(true);
    setSelectedEmpType(type);
    await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeType: type }),
    });
    setSavingType(false);
    await fetchEmployee();
  };

  const handleChecklistUpload = async (e: React.ChangeEvent<HTMLInputElement>, docKey: string) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    setUploading(docKey);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("candidateId", employee.candidate.id);
    fd.append("documentType", docKey);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    if (res.ok) await fetchEmployee();
    setUploading(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPendingUploadKey(null);
  };

  const handleFormSave = async () => {
    if (!employee) return;
    setSubmittingForm(true);
    setFormSaveError("");
    const payload = { formData, education, employment };
    try {
      const res = await fetch(`/api/employees/${employee.id}/onboarding-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setFormSaved(true);
        setShowForm(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setFormSaveError(data.error || `Save failed (${res.status}). Please restart the server.`);
      }
    } catch {
      setFormSaveError("Network error. Please try again.");
    }
    setSubmittingForm(false);
  };

  const f = (key: keyof FormData, label: string, type = "text", required = false) => (
    <div className="space-y-1" key={key}>
      <Label className="text-xs text-gray-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      <Input
        type={type}
        value={formData[key]}
        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        className="h-8 text-sm"
      />
    </div>
  );

  const sel = (key: keyof FormData, label: string, options: string[], required = false) => (
    <div className="space-y-1" key={key}>
      <Label className="text-xs text-gray-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      <select
        value={formData[key]}
        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  if (loading) {
    return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>;
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-lg bg-teal-600 p-6 text-white">
        <h2 className="text-2xl font-bold">Welcome, {session?.user?.name}!</h2>
        <p className="mt-1 text-teal-100">
          Employee Portal — {employee.employeeCode}
          {employee.designation ? ` · ${employee.designation}` : ""}
          {employee.department ? ` · ${employee.department}` : ""}
        </p>
      </div>

      {/* ── Section 1: Employee Type Selection ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4 text-teal-600" />
            Employee Category
          </CardTitle>
          <p className="text-xs text-gray-500 mt-0.5">
            Select your employment category — this determines the required document checklist.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <button
              onClick={() => handleSaveType("INDIA")}
              disabled={savingType}
              className={`flex items-center gap-3 rounded-lg border-2 px-5 py-4 transition-all w-44
                ${selectedEmpType === "INDIA"
                  ? "border-teal-600 bg-teal-50 text-teal-800"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"}`}
            >
              <MapPin className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-semibold">India</p>
                <p className="text-xs text-gray-500">Based in India</p>
              </div>
              {selectedEmpType === "INDIA" && <CheckCircle className="h-4 w-4 text-teal-600 ml-auto shrink-0" />}
            </button>
            <button
              onClick={() => handleSaveType("OVERSEAS")}
              disabled={savingType}
              className={`flex items-center gap-3 rounded-lg border-2 px-5 py-4 transition-all w-44
                ${selectedEmpType === "OVERSEAS"
                  ? "border-blue-600 bg-blue-50 text-blue-800"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"}`}
            >
              <Globe className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-semibold">Overseas</p>
                <p className="text-xs text-gray-500">Based outside India</p>
              </div>
              {selectedEmpType === "OVERSEAS" && <CheckCircle className="h-4 w-4 text-blue-600 ml-auto shrink-0" />}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Document Checklist ── */}
      {selectedEmpType && (() => {
        const checklist = selectedEmpType === "INDIA" ? INDIA_CHECKLIST : OVERSEAS_CHECKLIST;
        const accentColor = selectedEmpType === "INDIA" ? "teal" : "blue";
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className={`h-4 w-4 text-${accentColor}-600`} />
                Required Documents — {selectedEmpType === "INDIA" ? "India Employee" : "Overseas Employee"}
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                Upload each required document below. HR will review and approve them.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {checklist.map((item) => {
                const uploaded = documents.filter((d) => d.documentType === item.key);
                const isUploading = uploading === item.key;
                return (
                  <div key={item.key} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {uploaded.length > 0
                          ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                          : <div className="h-4 w-4 rounded-full border-2 border-gray-300 shrink-0" />
                        }
                        <span className="text-sm font-medium text-gray-800">{item.label}</span>
                        {item.required && <span className="text-xs text-red-500">*</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {uploaded.length > 0 && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                            ${uploaded[uploaded.length-1].approvalStatus === "APPROVED" ? "bg-green-100 text-green-700" :
                              uploaded[uploaded.length-1].approvalStatus === "REJECTED" ? "bg-red-100 text-red-700" :
                              "bg-yellow-100 text-yellow-700"}`}>
                            {uploaded[uploaded.length-1].approvalStatus}
                          </span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          disabled={!!uploading}
                          onClick={() => { setPendingUploadKey(item.key); fileInputRef.current?.click(); }}
                        >
                          {isUploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                          {uploaded.length > 0 ? "Re-upload" : "Upload"}
                        </Button>
                      </div>
                    </div>
                    {uploaded.length > 0 && (
                      <div className="ml-6 space-y-2">
                        {uploaded.map((doc) => (
                          <div key={doc.id} className="space-y-1">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-xs">
                                {doc.name}
                              </a>
                              <span className="text-gray-300">·</span>
                              <span>{formatDate(doc.createdAt)}</span>
                            </div>
                            {doc.extractedData && (() => {
                              try {
                                const fields = JSON.parse(doc.extractedData);
                                const entries = Object.entries(fields);
                                if (!entries.length) return null;
                                return (
                                  <div className="bg-gray-50 rounded px-2 py-1.5 text-xs text-gray-600 space-y-0.5">
                                    <p className="font-medium text-gray-700 mb-1">Extracted Fields</p>
                                    {entries.map(([k, v]) => (
                                      <p key={k}><span className="text-gray-400 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}:</span> {String(v)}</p>
                                    ))}
                                  </div>
                                );
                              } catch { return null; }
                            })()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => pendingUploadKey ? handleChecklistUpload(e, pendingUploadKey) : undefined}
              />
              <p className="text-xs text-gray-400 pt-1">Accepted formats: PDF, DOC, JPG, PNG</p>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Section 2b: Statutory Joining Forms ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-teal-600" />
            Statutory Joining Forms
          </CardTitle>
          <p className="text-xs text-gray-500 mt-0.5">
            Download the relevant forms, fill them out, and upload the signed copies in the section above.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { name: "Form A — PF Membership Declaration", href: "/forms/Form_A.pdf", desc: "Provident Fund membership declaration form" },
            { name: "Form B — PF Nomination Form", href: "/forms/Form_B.pdf", desc: "Provident Fund nominee details" },
            { name: "Form 1 — ESIC Declaration", href: "/forms/Form1.pdf", desc: "Employee State Insurance declaration" },
            { name: "Form 11 — EPF Composite Declaration", href: "/forms/Form_11.pdf", desc: "EPF new joinee composite claim form" },
            { name: "Application Form (Permanent)", href: "/forms/Application_Form_Permanent.pdf", desc: "Pre-employment application form" },
          ].map((form) => (
            <div key={form.href} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800">{form.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{form.desc}</p>
              </div>
              <a href={form.href} download target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="text-xs shrink-0">
                  <FileText className="h-3 w-3 mr-1" /> Download
                </Button>
              </a>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Additional templates from HR (if any) */}
      {templates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-teal-600" />
              Additional HR Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.name}</p>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                </div>
                <a href={t.fileUrl} download target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="text-xs shrink-0">
                    <FileText className="h-3 w-3 mr-1" /> Download
                  </Button>
                </a>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Section 3: Digital Information Form (optional, collapsible) ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowForm(!showForm)}>
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-teal-600" />
                Employee Information Form
                {formSaved && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-normal ml-1">
                    <CheckCircle className="h-3 w-3" /> Saved
                  </span>
                )}
              </CardTitle>
            </div>
            {showForm ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Fill your personal, bank, and professional details digitally. You may also upload a completed physical form above instead.
          </p>
        </CardHeader>

        {showForm && (
          <CardContent className="space-y-6">
            {/* 1. Personal Identity */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Personal Identity</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {sel("salutation", "Salutation", ["Mr", "Mrs", "Ms", "Dr"], true)}
                {f("firstName", "First Name", "text", true)}
                {f("middleName", "Middle Name")}
                {f("lastName", "Last Name", "text", true)}
                {f("fatherFirstName", "Father's First Name")}
                {f("fatherLastName", "Father's Last Name")}
              </div>
            </div>

            {/* 2. Personal Details */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Personal Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {f("dateOfBirth", "Date of Birth", "date", true)}
                {f("dateOfJoining", "Date of Joining", "date", true)}
                {sel("gender", "Gender", ["Male", "Female", "Other"], true)}
                {sel("maritalStatus", "Marital Status", ["Single", "Married", "Divorced", "Widowed"], true)}
                {sel("religion", "Religion", ["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Other"], true)}
                {sel("bloodGroup", "Blood Group", ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], true)}
              </div>
            </div>

            {/* 2b. Family Information */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Family Information</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {sel("hasChildren", "Do you have children?", ["Yes", "No"], true)}
                {sel("hasSpouse", "Do you have a spouse?", ["Yes", "No"], true)}
                {formData.hasSpouse === "Yes" && f("spouseDateOfBirth", "Spouse Date of Birth", "date", true)}
              </div>
            </div>

            {/* 3. Present Address */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Present Address</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-gray-600">Street Address</Label>
                  <textarea
                    rows={2}
                    value={formData.presentAddress}
                    onChange={(e) => setFormData({ ...formData, presentAddress: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                {f("presentPinCode", "PIN Code")}
                {f("presentMobile", "Mobile *", "tel", true)}
                {f("presentEmail", "Email *", "email", true)}
              </div>
            </div>

            {/* 4. Permanent Address */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Permanent Address</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-gray-600">Street Address</Label>
                  <textarea
                    rows={2}
                    value={formData.permanentAddress}
                    onChange={(e) => setFormData({ ...formData, permanentAddress: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                {f("permanentPinCode", "PIN Code")}
                {f("permanentMobile", "Mobile")}
              </div>
            </div>

            {/* 5. Bank Details */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Bank Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {f("employeeNameAsPerBank", "Name as per Bank Account", "text", true)}
                {f("bankName", "Bank Name", "text", true)}
                {f("bankBranchName", "Bank Branch", "text", true)}
                {f("bankAccountNumber", "Account Number", "text", true)}
                {f("ifscCode", "IFSC Code", "text", true)}
              </div>
            </div>

            {/* 6. Identity Documents */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Identity Documents</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(selectedEmpType === "INDIA" || !selectedEmpType) && f("aadhaarNumber", "Aadhaar Number", "text", selectedEmpType === "INDIA")}
                {(selectedEmpType === "INDIA" || !selectedEmpType) && f("panNumber", "PAN Number", "text", selectedEmpType === "INDIA")}
                {(selectedEmpType === "OVERSEAS" || !selectedEmpType) && f("passportNumber", "Passport Number", "text", selectedEmpType === "OVERSEAS")}
                {f("esicNumber", "ESIC Card Number")}
              </div>
            </div>

            {/* 7. Emergency Contact */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Emergency Contact</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {f("emergencyName", "Contact Name")}
                {f("emergencyRelationship", "Relationship")}
                {f("emergencyMobile", "Mobile", "tel")}
              </div>
            </div>

            {/* 8. Education History */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Education History</p>
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 px-1">
                  <span>Institute / Board</span><span>Exam / Degree</span><span>Year</span><span>%/Grade</span>
                </div>
                {education.map((row, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-center">
                    <Input value={row.institute} onChange={(e) => { const r = [...education]; r[i].institute = e.target.value; setEducation(r); }} className="h-8 text-xs" placeholder="Institute name" />
                    <Input value={row.exam} onChange={(e) => { const r = [...education]; r[i].exam = e.target.value; setEducation(r); }} className="h-8 text-xs" placeholder="e.g. B.Sc." />
                    <Input value={row.year} onChange={(e) => { const r = [...education]; r[i].year = e.target.value; setEducation(r); }} className="h-8 text-xs" placeholder="2020" />
                    <div className="flex items-center gap-1">
                      <Input value={row.percentage} onChange={(e) => { const r = [...education]; r[i].percentage = e.target.value; setEducation(r); }} className="h-8 text-xs" placeholder="75%" />
                      {education.length > 1 && (
                        <button onClick={() => setEducation(education.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="text-xs text-teal-600"
                  onClick={() => setEducation([...education, { institute: "", exam: "", year: "", percentage: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Row
                </Button>
              </div>
            </div>

            {/* 9. Employment History */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Employment History</p>
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-2 text-xs font-medium text-gray-500 px-1">
                  <span>Employer</span><span>From</span><span>To</span><span>Role</span><span>Last CTC (₹)</span>
                </div>
                {employment.map((row, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 items-center">
                    <Input value={row.employer} onChange={(e) => { const r = [...employment]; r[i].employer = e.target.value; setEmployment(r); }} className="h-8 text-xs" placeholder="Company, City" />
                    <Input value={row.from} onChange={(e) => { const r = [...employment]; r[i].from = e.target.value; setEmployment(r); }} className="h-8 text-xs" placeholder="MM/YY" />
                    <Input value={row.to} onChange={(e) => { const r = [...employment]; r[i].to = e.target.value; setEmployment(r); }} className="h-8 text-xs" placeholder="MM/YY" />
                    <Input value={row.role} onChange={(e) => { const r = [...employment]; r[i].role = e.target.value; setEmployment(r); }} className="h-8 text-xs" placeholder="Position" />
                    <div className="flex items-center gap-1">
                      <Input value={row.lastCTC} onChange={(e) => { const r = [...employment]; r[i].lastCTC = e.target.value; setEmployment(r); }} className="h-8 text-xs" placeholder="Annual" />
                      {employment.length > 1 && (
                        <button onClick={() => setEmployment(employment.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="text-xs text-teal-600"
                  onClick={() => setEmployment([...employment, { employer: "", from: "", to: "", role: "", lastCTC: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Row
                </Button>
              </div>
            </div>

            {/* 10. Compliance & Medical Declarations */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Compliance & Medical Declarations</p>
              <div className="space-y-4">
                {([
                  { key: "everConvicted" as keyof FormData, detailKey: "everConvictedDetails" as keyof FormData, label: "Have you ever been convicted of a criminal offence?" },
                  { key: "drugAlcoholTreatment" as keyof FormData, detailKey: "drugAlcoholDetails" as keyof FormData, label: "Have you ever required medical treatment or counselling for drug/alcohol abuse?" },
                  { key: "preExistingConditions" as keyof FormData, detailKey: "preExistingDetails" as keyof FormData, label: "Do you have any pre-existing medical conditions or illnesses?" },
                  { key: "physicalDefect" as keyof FormData, detailKey: "physicalDefectDetails" as keyof FormData, label: "Do you suffer from any physical defect or partial disability?" },
                ] as { key: keyof FormData; detailKey: keyof FormData; label: string }[]).map(({ key, detailKey, label }) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-start gap-4">
                      <p className="text-sm text-gray-700 flex-1">{label} <span className="text-red-500">*</span></p>
                      <div className="flex gap-3 shrink-0">
                        {["Yes", "No"].map((opt) => (
                          <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={key}
                              value={opt}
                              checked={formData[key] === opt}
                              onChange={() => setFormData({ ...formData, [key]: opt })}
                              className="accent-teal-600"
                            />
                            <span className="text-sm">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {formData[key] === "Yes" && (
                      <div className="ml-4">
                        <Label className="text-xs text-gray-600">Please provide details (optional)</Label>
                        <textarea
                          rows={2}
                          value={formData[detailKey]}
                          onChange={(e) => setFormData({ ...formData, [detailKey]: e.target.value })}
                          className="w-full mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                          placeholder="Provide any relevant details…"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 11. Declaration */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Declaration</p>
              <div className="grid grid-cols-2 gap-3">
                {f("declarationDate", "Declaration Date", "date")}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                I hereby declare that all the information provided above is true and correct to the best of my knowledge.
              </p>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleFormSave}
                  disabled={submittingForm}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {submittingForm && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {formSaved ? "Update Saved Data" : "Save Information"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                {formSaved && !formSaveError && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Data saved successfully
                  </span>
                )}
              </div>
              {formSaveError && (
                <p className="text-xs text-red-600">{formSaveError}</p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Section 3: Employee Dashboard ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Your Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
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
          <CardTitle className="text-base">Your Onboarding Pipeline</CardTitle>
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
    </div>
  );
}
