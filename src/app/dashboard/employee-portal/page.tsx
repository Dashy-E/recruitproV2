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
  ChevronDown, ChevronUp,
} from "lucide-react";
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
  approvalStatus: string;
}

interface EducationRow { institute: string; exam: string; year: string; percentage: string }
interface EmploymentRow { employer: string; from: string; to: string; role: string; lastCTC: string }

type FormData = {
  // Personal Identity
  salutation: string; firstName: string; middleName: string; lastName: string;
  fatherFirstName: string; fatherLastName: string;
  // Personal Details
  dateOfBirth: string; gender: string; maritalStatus: string; spouseName: string;
  religion: string; bloodGroup: string;
  // Present Address
  presentAddress: string; presentPinCode: string; presentMobile: string; presentEmail: string;
  // Permanent Address
  permanentAddress: string; permanentPinCode: string; permanentMobile: string;
  // Bank Details
  bankName: string; bankBranchName: string; bankAccountNumber: string; ifscCode: string; employeeNameAsPerBank: string;
  // Identity Docs
  aadhaarNumber: string; panNumber: string; passportNumber: string;
  // Emergency Contact
  emergencyName: string; emergencyRelationship: string; emergencyMobile: string;
  // Career Objective
  careerObjective: string;
  // Declaration
  declarationDate: string;
};

const EMPTY_FORM: FormData = {
  salutation: "", firstName: "", middleName: "", lastName: "",
  fatherFirstName: "", fatherLastName: "",
  dateOfBirth: "", gender: "", maritalStatus: "", spouseName: "",
  religion: "", bloodGroup: "",
  presentAddress: "", presentPinCode: "", presentMobile: "", presentEmail: "",
  permanentAddress: "", permanentPinCode: "", permanentMobile: "",
  bankName: "", bankBranchName: "", bankAccountNumber: "", ifscCode: "", employeeNameAsPerBank: "",
  aadhaarNumber: "", panNumber: "", passportNumber: "",
  emergencyName: "", emergencyRelationship: "", emergencyMobile: "",
  careerObjective: "",
  declarationDate: "",
};

const POST_JOIN_STAGES = CANDIDATE_STAGES.filter((s) => s.step >= 11);

export default function EmployeePortalPage() {
  const { data: session } = useSession();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [education, setEducation] = useState<EducationRow[]>([{ institute: "", exam: "", year: "", percentage: "" }]);
  const [employment, setEmployment] = useState<EmploymentRow[]>([{ employer: "", from: "", to: "", role: "", lastCTC: "" }]);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [formSaved, setFormSaved] = useState(false);
  const [formSaveError, setFormSaveError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEmployee = async () => {
    const res = await fetch("/api/employees/me");
    if (res.ok) {
      const data = await res.json();
      setEmployee(data.employee);
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
      // Load existing form data if present
      if (data.employee) {
        const dr = await fetch(`/api/employees/${data.employee.id}/onboarding-data`);
        if (dr.ok) {
          const saved = await dr.json();
          if (saved && saved.formData) {
            // saved.formData is the parsed JSON object: { formData, education, employment }
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
    if (res.ok) await fetchEmployee();
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

      {/* ── Section 1: Document Upload (always visible, optional) ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-teal-600" />
              Document Upload
              {documents.length > 0 && (
                <Badge variant="secondary" className="ml-1">{documents.length} uploaded</Badge>
              )}
            </CardTitle>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Upload your ID proof, certificates, signed forms, or any other required documents.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.length > 0 && (
            <div className="space-y-1">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-md border bg-gray-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      {doc.name}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${doc.approvalStatus === "APPROVED" ? "bg-green-100 text-green-700" :
                        doc.approvalStatus === "REJECTED" ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"}`}>
                      {doc.approvalStatus}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(doc.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
              {uploading ? "Uploading…" : "Upload Document"}
            </Button>
            <span className="text-xs text-gray-400">PDF, DOC, JPG, PNG</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Digital Information Form (optional, collapsible) ── */}
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
                {sel("salutation", "Salutation", ["Mr", "Mrs", "Ms"], true)}
                {f("firstName", "First Name", "text", true)}
                {f("middleName", "Middle Name")}
                {f("lastName", "Last Name", "text", true)}
                {f("fatherFirstName", "Father's First Name", "text", true)}
                {f("fatherLastName", "Father's Last Name", "text", true)}
              </div>
            </div>

            {/* 2. Personal Details */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Personal Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {f("dateOfBirth", "Date of Birth", "date", true)}
                {sel("gender", "Gender", ["Male", "Female", "Other"], true)}
                {sel("maritalStatus", "Marital Status", ["Single", "Married", "Divorced", "Widowed"])}
                {f("spouseName", "Spouse Name (if married)")}
                {f("religion", "Religion")}
                {f("bloodGroup", "Blood Group")}
              </div>
            </div>

            {/* 3. Present Address */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Present Address</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-gray-600">Street Address *</Label>
                  <textarea
                    rows={2}
                    value={formData.presentAddress}
                    onChange={(e) => setFormData({ ...formData, presentAddress: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                {f("presentPinCode", "PIN Code", "text", true)}
                {f("presentMobile", "Mobile", "tel", true)}
                {f("presentEmail", "Email", "email", true)}
              </div>
            </div>

            {/* 4. Permanent Address */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Permanent Address</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-gray-600">Street Address *</Label>
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
                {f("aadhaarNumber", "Aadhaar Number", "text", true)}
                {f("panNumber", "PAN Number", "text", true)}
                {f("passportNumber", "Passport Number (if applicable)")}
              </div>
            </div>

            {/* 7. Emergency Contact */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Emergency Contact</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {f("emergencyName", "Contact Name", "text", true)}
                {f("emergencyRelationship", "Relationship", "text", true)}
                {f("emergencyMobile", "Mobile", "tel", true)}
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

            {/* 10. Declaration */}
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
