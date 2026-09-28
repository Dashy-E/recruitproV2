"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Upload, CheckCircle, FileText, UserCheck, Plus, Trash2,
  ChevronDown, ChevronUp, Globe, MapPin,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

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
    recruitmentEntity: string | null;
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

export interface EducationRow { institute: string; exam: string; year: string; percentage: string }
export interface EmploymentRow { employer: string; from: string; to: string; role: string; lastCTC: string }
export interface ReferenceRow {
  firstName: string; middleName: string; familyName: string; address: string;
  companyName: string; relationship: string; residenceTel: string; mobileTel: string;
}
export interface LanguageRow { language: string; read: string; write: string; speak: string }

// Fields from the paper "Application Form of Mitra S K Pvt. Ltd." that aren't
// already collected by the Employee Information Form below — kept as a
// separate form/section so existing data (name, address, bank, education,
// employment, compliance) isn't asked for twice. Both sections save into the
// same freeform onboarding-data blob (see handleAppFormSave).
export type AppFormData = {
  positionAppliedFor: string;
  nameInitial: string; fatherInitial: string;
  height: string; weight: string;
  employmentType: string; // "Permanent" | "Contractual"
  presentResidenceTel: string; permanentResidenceTel: string; permanentEmail: string;
  bankBranchAddress: string; micrCode: string;
  spouseName: string; numberOfSons: string; numberOfDaughters: string;
  drivingLicenceNumber: string; electionCardNumber: string; rationCardNumber: string; otherDocumentNumber: string;
  emergencyAddress: string; emergencyResidenceTel: string;
  hobbies: string;
  recentOperation: string; recentOperationDetails: string;
  achievement: string;
  strengths: string;
  suitability: string;
  relativeInCompany: string; relativeInCompanyDetails: string;
};

const EMPTY_APP_FORM: AppFormData = {
  positionAppliedFor: "",
  nameInitial: "", fatherInitial: "",
  height: "", weight: "",
  employmentType: "",
  presentResidenceTel: "", permanentResidenceTel: "", permanentEmail: "",
  bankBranchAddress: "", micrCode: "",
  spouseName: "", numberOfSons: "", numberOfDaughters: "",
  drivingLicenceNumber: "", electionCardNumber: "", rationCardNumber: "", otherDocumentNumber: "",
  emergencyAddress: "", emergencyResidenceTel: "",
  hobbies: "",
  recentOperation: "", recentOperationDetails: "",
  achievement: "",
  strengths: "",
  suitability: "",
  relativeInCompany: "", relativeInCompanyDetails: "",
};

const EMPTY_REFERENCE: ReferenceRow = {
  firstName: "", middleName: "", familyName: "", address: "",
  companyName: "", relationship: "", residenceTel: "", mobileTel: "",
};

const ENCLOSURE_ITEMS = [
  "Bio data", "Age proof", "Address Proof", "Bank Proof",
  "All Credentials (Certificates)", "Two Passport size Photographs", "Payslips (Last 3 Months)", "ESIC Declaration",
  "Relieving Letter", "Form 11", "Aadhaar Card", "Disability Certificate (If any)",
];

export type FormData = {
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

export interface PfNomineeRow { name: string; address: string; relationship: string; age: string; share: string }
export interface EsicFamilyMemberRow { name: string; dob: string; relationship: string; residingWithEmployee: string; placeOfResidence: string }
export interface PreviousPfEmploymentRow { establishment: string; uan: string; pfNumber: string; dateOfJoining: string; dateOfExit: string; schemeCertNo: string; ppoNumber: string; ncpDays: string }
export interface Chapter6ADeductionRow { section: string; particulars: string; amount: string }
export interface GratuityNomineeRow { name: string; address: string; relationship: string; age: string; proportion: string }

// Extra fields for the statutory/HR forms below (Bank Details, Confidentiality
// Declaration, PF Form A/B, ESIC Form 1, EPFO Form 11, Consent & Form 12BB,
// Gratuity Nomination) that aren't already collected above. Same pattern as
// AppFormData — saved into the same onboarding-data blob. Office-only fields
// (branch office stamps, employer certification blocks, witness signatures)
// have no input and are left blank on the generated PDF.
export type StatutoryFormsData = {
  // Bank Details Form
  bankAccountType: string;
  // Declaration of Confidentiality & Impartiality
  confidentialityDate: string;
  // PF Form A
  formADate: string; natureOfAppointment: string; salaryPerMensem: string;
  // PF Form B (nomination)
  husbandName: string;
  pfNomineeVillage: string; pfNomineeThana: string; pfNomineePostOffice: string; pfNomineeDistrict: string; pfNomineeState: string;
  formBDate: string;
  // ESIC Form 1
  insuranceNumber: string; employerCode: string;
  previousInsuranceNo: string; previousEmployerCode: string; previousEmployerNameAddress: string;
  // EPFO Form 11
  previousPfMember: string; previousPensionMember: string;
  isInternationalWorker: string; countryOfOrigin: string;
  // Consent Letter & Form 12BB
  taxRegime: string; financialYear: string;
  rentPaidToLandlord: string; landlordName: string; landlordAddress: string; landlordPAN: string;
  ltcAmount: string;
  homeLoanInterest: string; lenderName: string; lenderAddress: string; lenderPAN: string;
  // Gratuity Nomination (Form F)
  gratuityDate: string;
};

const EMPTY_STATUTORY_FORMS: StatutoryFormsData = {
  bankAccountType: "",
  confidentialityDate: "",
  formADate: "", natureOfAppointment: "", salaryPerMensem: "",
  husbandName: "",
  pfNomineeVillage: "", pfNomineeThana: "", pfNomineePostOffice: "", pfNomineeDistrict: "", pfNomineeState: "",
  formBDate: "",
  insuranceNumber: "", employerCode: "",
  previousInsuranceNo: "", previousEmployerCode: "", previousEmployerNameAddress: "",
  previousPfMember: "", previousPensionMember: "",
  isInternationalWorker: "", countryOfOrigin: "",
  taxRegime: "", financialYear: "",
  rentPaidToLandlord: "", landlordName: "", landlordAddress: "", landlordPAN: "",
  ltcAmount: "",
  homeLoanInterest: "", lenderName: "", lenderAddress: "", lenderPAN: "",
  gratuityDate: "",
};

export default function EmployeePortalPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const permissions = (session?.user as { permissions?: string[] })?.permissions || [];
  // Admin/HR (MANAGE_EMPLOYEES) get the same portal for a chosen employee
  // instead of "my own record" — the EMPLOYEE role always sees their own.
  const isAdminMode = role !== "EMPLOYEE" && permissions.includes("MANAGE_EMPLOYEES");
  const [employeeList, setEmployeeList] = useState<{ id: string; employeeCode: string; candidate: { firstName: string; lastName: string } }[]>([]);
  const [viewingEmployeeId, setViewingEmployeeId] = useState<string | null>(null);
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

  // Application Form (the remaining paper-form fields not already above)
  const [appFormData, setAppFormData] = useState<AppFormData>(EMPTY_APP_FORM);
  const [references, setReferences] = useState<ReferenceRow[]>([{ ...EMPTY_REFERENCE }, { ...EMPTY_REFERENCE }]);
  const [professionalQuals, setProfessionalQuals] = useState<EducationRow[]>([{ institute: "", exam: "", year: "", percentage: "" }]);
  const [languages, setLanguages] = useState<LanguageRow[]>([{ language: "", read: "", write: "", speak: "" }]);
  const [enclosures, setEnclosures] = useState<string[]>([]);
  const [showAppForm, setShowAppForm] = useState(false);
  const [appFormSaved, setAppFormSaved] = useState(false);
  const [submittingAppForm, setSubmittingAppForm] = useState(false);
  const [downloadingAppForm, setDownloadingAppForm] = useState(false);
  const [appFormSaveError, setAppFormSaveError] = useState("");

  // Statutory / HR forms (Bank Details, Confidentiality Declaration, PF Form
  // A/B, ESIC Form 1, EPFO Form 11, Consent & Form 12BB, Gratuity Nomination)
  const [statutoryData, setStatutoryData] = useState<StatutoryFormsData>(EMPTY_STATUTORY_FORMS);
  const [pfNominees, setPfNominees] = useState<PfNomineeRow[]>([{ name: "", address: "", relationship: "", age: "", share: "" }]);
  const [esicFamilyMembers, setEsicFamilyMembers] = useState<EsicFamilyMemberRow[]>([{ name: "", dob: "", relationship: "", residingWithEmployee: "", placeOfResidence: "" }]);
  const [previousPfEmployment, setPreviousPfEmployment] = useState<PreviousPfEmploymentRow[]>([{ establishment: "", uan: "", pfNumber: "", dateOfJoining: "", dateOfExit: "", schemeCertNo: "", ppoNumber: "", ncpDays: "" }]);
  const [chapter6ADeductions, setChapter6ADeductions] = useState<Chapter6ADeductionRow[]>([{ section: "", particulars: "", amount: "" }]);
  const [gratuityNominees, setGratuityNominees] = useState<GratuityNomineeRow[]>([{ name: "", address: "", relationship: "", age: "", proportion: "" }]);
  const [showStatForm, setShowStatForm] = useState<Record<string, boolean>>({});
  const [statFormSaved, setStatFormSaved] = useState<Record<string, boolean>>({});
  const [submittingStatForm, setSubmittingStatForm] = useState<string | null>(null);
  const [downloadingStatForm, setDownloadingStatForm] = useState<string | null>(null);
  const [statFormError, setStatFormError] = useState<Record<string, string>>({});

  // Clears everything from whichever employee was previously loaded so
  // switching who's selected in admin mode never shows stale data if the
  // next fetch fails or a field just isn't set for the new employee.
  const resetPortalState = () => {
    setEmployee(null);
    setDocuments([]);
    setSelectedEmpType(null);
    setFormData(EMPTY_FORM);
    setEducation([{ institute: "", exam: "", year: "", percentage: "" }]);
    setEmployment([{ employer: "", from: "", to: "", role: "", lastCTC: "" }]);
    setFormSaved(false);
    setAppFormData(EMPTY_APP_FORM);
    setReferences([{ ...EMPTY_REFERENCE }, { ...EMPTY_REFERENCE }]);
    setProfessionalQuals([{ institute: "", exam: "", year: "", percentage: "" }]);
    setLanguages([{ language: "", read: "", write: "", speak: "" }]);
    setEnclosures([]);
    setAppFormSaved(false);
    setStatutoryData(EMPTY_STATUTORY_FORMS);
    setPfNominees([{ name: "", address: "", relationship: "", age: "", share: "" }]);
    setEsicFamilyMembers([{ name: "", dob: "", relationship: "", residingWithEmployee: "", placeOfResidence: "" }]);
    setPreviousPfEmployment([{ establishment: "", uan: "", pfNumber: "", dateOfJoining: "", dateOfExit: "", schemeCertNo: "", ppoNumber: "", ncpDays: "" }]);
    setChapter6ADeductions([{ section: "", particulars: "", amount: "" }]);
    setGratuityNominees([{ name: "", address: "", relationship: "", age: "", proportion: "" }]);
    setStatFormSaved({});
  };

  const fetchEmployee = async (idOverride?: string) => {
    const targetId = idOverride ?? viewingEmployeeId;
    if (isAdminMode && !targetId) { setLoading(false); return; }
    const res = isAdminMode ? await fetch(`/api/employees/${targetId}`) : await fetch("/api/employees/me");
    if (res.ok) {
      const data = await res.json();
      setEmployee(data.employee);
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
      if (data.employee?.id) setViewingEmployeeId(data.employee.id);
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
            if (parsed.appFormData) {
              setAppFormData(parsed.appFormData);
              setAppFormSaved(true);
            }
            if (parsed.references) setReferences(parsed.references);
            if (parsed.professionalQualifications) setProfessionalQuals(parsed.professionalQualifications);
            if (parsed.languages) setLanguages(parsed.languages);
            if (parsed.enclosures) setEnclosures(parsed.enclosures);
            if (parsed.statutoryData) setStatutoryData(parsed.statutoryData);
            if (parsed.pfNominees) setPfNominees(parsed.pfNominees);
            if (parsed.esicFamilyMembers) setEsicFamilyMembers(parsed.esicFamilyMembers);
            if (parsed.previousPfEmployment) setPreviousPfEmployment(parsed.previousPfEmployment);
            if (parsed.chapter6ADeductions) setChapter6ADeductions(parsed.chapter6ADeductions);
            if (parsed.gratuityNominees) setGratuityNominees(parsed.gratuityNominees);
            if (parsed.statFormSaved) setStatFormSaved(parsed.statFormSaved);
          }
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!session) return;
    fetch("/api/document-templates").then((r) => r.json()).then((d) => setTemplates(Array.isArray(d) ? d : []));
    if (isAdminMode) {
      fetch("/api/employees").then((r) => r.json()).then((d) => setEmployeeList(Array.isArray(d) ? d : []));
      setLoading(false);
    } else {
      fetchEmployee();
    }
  }, [session]);

  const handleSelectEmployee = (id: string) => {
    resetPortalState();
    setViewingEmployeeId(id);
    setLoading(true);
    fetchEmployee(id);
  };

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

  // NOTE: the onboarding-data endpoint stores one freeform JSON blob per
  // employee and POST fully replaces it — so every save from either this
  // form or the Application Form below must include ALL of both sections'
  // state, not just its own fields, or it would silently wipe out whatever
  // the other one had already saved.
  const buildOnboardingPayload = () => ({
    formData, education, employment,
    appFormData, references, professionalQualifications: professionalQuals, languages, enclosures,
    statutoryData, pfNominees, esicFamilyMembers, previousPfEmployment, chapter6ADeductions, gratuityNominees, statFormSaved,
  });

  const handleFormSave = async () => {
    if (!employee) return;
    setSubmittingForm(true);
    setFormSaveError("");
    try {
      const res = await fetch(`/api/employees/${employee.id}/onboarding-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOnboardingPayload()),
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

  const handleAppFormSave = async () => {
    if (!employee) return;
    setSubmittingAppForm(true);
    setAppFormSaveError("");
    try {
      const res = await fetch(`/api/employees/${employee.id}/onboarding-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOnboardingPayload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAppFormSaveError(data.error || `Save failed (${res.status}). Please restart the server.`);
        setSubmittingAppForm(false);
        return;
      }
      setAppFormSaved(true);
    } catch {
      setAppFormSaveError("Network error. Please try again.");
    }
    setSubmittingAppForm(false);
  };

  const handleAppFormDownload = async () => {
    if (!employee) return;
    setDownloadingAppForm(true);
    setAppFormSaveError("");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ApplicationFormPdfDocument } = await import("@/components/application-form-pdf-document");
      const blob = await pdf(
        <ApplicationFormPdfDocument
          data={{
            employeeCode: employee.employeeCode,
            department: employee.department,
            designation: employee.designation,
            recruitmentEntity: employee.candidate.recruitmentEntity,
            formData, education, employment,
            appFormData, references, professionalQualifications: professionalQuals, languages, enclosures,
          }}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Application-Form-${employee.employeeCode}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setAppFormSaveError("Failed to generate the PDF. Please try again.");
    }
    setDownloadingAppForm(false);
  };

  // Shared save-only handler for the 8 statutory/HR form sections below —
  // persists the combined onboarding-data blob, no PDF involved.
  const handleStatFormSave = async (formKey: string) => {
    if (!employee) return;
    setSubmittingStatForm(formKey);
    setStatFormError((prev) => ({ ...prev, [formKey]: "" }));
    try {
      const nextSaved = { ...statFormSaved, [formKey]: true };
      const res = await fetch(`/api/employees/${employee.id}/onboarding-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildOnboardingPayload(), statFormSaved: nextSaved }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatFormError((prev) => ({ ...prev, [formKey]: data.error || `Save failed (${res.status}). Please restart the server.` }));
        setSubmittingStatForm(null);
        return;
      }
      setStatFormSaved(nextSaved);
    } catch {
      setStatFormError((prev) => ({ ...prev, [formKey]: "Network error. Please try again." }));
    }
    setSubmittingStatForm(null);
  };

  // Shared download-only handler — builds and downloads the PDF for whatever
  // is currently filled in on screen, independent of the Save button.
  const handleStatFormDownload = async (formKey: string, filename: string, buildPdf: () => React.ReactElement) => {
    setDownloadingStatForm(formKey);
    setStatFormError((prev) => ({ ...prev, [formKey]: "" }));
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(buildPdf() as React.ReactElement<import("@react-pdf/renderer").DocumentProps>).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setStatFormError((prev) => ({ ...prev, [formKey]: "Failed to generate the PDF. Please try again." }));
    }
    setDownloadingStatForm(null);
  };

  const sf = (key: keyof StatutoryFormsData, label: string, type = "text") => (
    <div className="space-y-1" key={key}>
      <Label className="text-xs text-gray-600">{label}</Label>
      <Input
        type={type}
        value={statutoryData[key]}
        onChange={(e) => setStatutoryData({ ...statutoryData, [key]: e.target.value })}
        className="h-8 text-sm"
      />
    </div>
  );

  const sSel = (key: keyof StatutoryFormsData, label: string, options: string[]) => (
    <div className="space-y-1" key={key}>
      <Label className="text-xs text-gray-600">{label}</Label>
      <select
        value={statutoryData[key]}
        onChange={(e) => setStatutoryData({ ...statutoryData, [key]: e.target.value })}
        className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const sYesNo = (key: keyof StatutoryFormsData, label: string) => (
    <div className="flex items-start gap-4" key={key}>
      <p className="text-sm text-gray-700 flex-1">{label}</p>
      <div className="flex gap-3 shrink-0">
        {["Yes", "No"].map((opt) => (
          <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name={key} value={opt} checked={statutoryData[key] === opt}
              onChange={() => setStatutoryData({ ...statutoryData, [key]: opt })} className="accent-teal-600" />
            <span className="text-sm">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );

  // Wraps a collapsible "Card" section shared by all 8 statutory/HR forms —
  // each caller just supplies its own field content plus a save callback and
  // a download callback. Save persists the data; Download (labelled with the
  // form's own name) generates & downloads the PDF from whatever is
  // currently on screen — the two are independent buttons, not one combined
  // action, so filling out a form doesn't force a download every time.
  const statFormSection = (key: string, title: string, description: string, content: React.ReactNode, onSave: () => void, onDownload: () => void) => (
    <Card key={key}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowStatForm({ ...showStatForm, [key]: !showStatForm[key] })}>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-teal-600" />
            {title}
            {statFormSaved[key] && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-normal ml-1">
                <CheckCircle className="h-3 w-3" /> Saved
              </span>
            )}
          </CardTitle>
          {showStatForm[key] ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </CardHeader>
      {showStatForm[key] && (
        <CardContent className="space-y-6">
          {content}
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center gap-3">
              <Button onClick={onSave} disabled={submittingStatForm === key} className="bg-teal-600 hover:bg-teal-700 text-white">
                {submittingStatForm === key && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save
              </Button>
              <Button onClick={onDownload} disabled={downloadingStatForm === key} variant="outline" className="border-teal-600 text-teal-700 hover:bg-teal-50">
                {downloadingStatForm === key ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Download {title}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowStatForm({ ...showStatForm, [key]: false })}>Cancel</Button>
            </div>
            {statFormError[key] && <p className="text-xs text-red-600">{statFormError[key]}</p>}
          </div>
        </CardContent>
      )}
    </Card>
  );

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

  const af = (key: keyof AppFormData, label: string, type = "text") => (
    <div className="space-y-1" key={key}>
      <Label className="text-xs text-gray-600">{label}</Label>
      <Input
        type={type}
        value={appFormData[key]}
        onChange={(e) => setAppFormData({ ...appFormData, [key]: e.target.value })}
        className="h-8 text-sm"
      />
    </div>
  );

  const aSel = (key: keyof AppFormData, label: string, options: string[]) => (
    <div className="space-y-1" key={key}>
      <Label className="text-xs text-gray-600">{label}</Label>
      <select
        value={appFormData[key]}
        onChange={(e) => setAppFormData({ ...appFormData, [key]: e.target.value })}
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

  const employeePicker = isAdminMode && (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="h-4 w-4 text-teal-600" />
          Viewing Employee Portal As
        </CardTitle>
        <p className="text-xs text-gray-500 mt-0.5">Pick an employee to view or fill out their portal on their behalf.</p>
      </CardHeader>
      <CardContent>
        <select
          value={viewingEmployeeId || ""}
          onChange={(e) => e.target.value && handleSelectEmployee(e.target.value)}
          className="w-full sm:w-96 h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Select an employee…</option>
          {employeeList.map((e) => (
            <option key={e.id} value={e.id}>{e.employeeCode} — {e.candidate.firstName} {e.candidate.lastName}</option>
          ))}
        </select>
      </CardContent>
    </Card>
  );

  if (!employee) {
    if (isAdminMode) {
      return <div className="space-y-6 max-w-4xl mx-auto">{employeePicker}</div>;
    }
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
      {employeePicker}
      {/* Header */}
      <div className="rounded-lg bg-teal-600 p-6 text-white">
        <h2 className="text-2xl font-bold">
          {isAdminMode ? `${employee.candidate.firstName} ${employee.candidate.lastName}'s Portal` : `Welcome, ${session?.user?.name}!`}
        </h2>
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

      {/* ── Application Form (remaining paper-form fields) ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowAppForm(!showAppForm)}>
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-teal-600" />
                Application Form
                {appFormSaved && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-normal ml-1">
                    <CheckCircle className="h-3 w-3" /> Saved
                  </span>
                )}
              </CardTitle>
            </div>
            {showAppForm ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            A few more details from the official Application Form, then save to download it filled in as a PDF.
          </p>
        </CardHeader>

        {showAppForm && (
          <CardContent className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Position &amp; Name</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {af("positionAppliedFor", "Position Applied For")}
                {af("nameInitial", "Your Initial")}
                {af("fatherInitial", "Father's Initial")}
                {aSel("employmentType", "Employment Type", ["Permanent", "Contractual"])}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Physical Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {af("height", "Height (Cms)")}
                {af("weight", "Weight (Kgs)")}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Additional Contact Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {af("presentResidenceTel", "Present Residence Tel.", "tel")}
                {af("permanentResidenceTel", "Permanent Residence Tel.", "tel")}
                {af("permanentEmail", "Permanent Email", "email")}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Additional Bank Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {af("bankBranchAddress", "Bank Branch Address")}
                {af("micrCode", "MICR Code")}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Family</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {formData.hasSpouse === "Yes" && af("spouseName", "Spouse Name")}
                {formData.hasChildren === "Yes" && af("numberOfSons", "No. of Sons")}
                {formData.hasChildren === "Yes" && af("numberOfDaughters", "No. of Daughters")}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Additional Identity Documents</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {af("drivingLicenceNumber", "Driving Licence Number")}
                {af("electionCardNumber", "Election Card Number")}
                {af("rationCardNumber", "Ration Card Number")}
                {af("otherDocumentNumber", "Other Document Number")}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Emergency Contact — Additional Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {af("emergencyAddress", "Address")}
                {af("emergencyResidenceTel", "Residence Tel.", "tel")}
              </div>
            </div>

            {/* References */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">References (two persons known to you but not relatives)</p>
              <div className="space-y-4">
                {references.map((row, i) => (
                  <div key={i} className="rounded-lg border p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Input value={row.firstName} onChange={(e) => { const r = [...references]; r[i] = { ...r[i], firstName: e.target.value }; setReferences(r); }} className="h-8 text-xs" placeholder="First Name" />
                    <Input value={row.middleName} onChange={(e) => { const r = [...references]; r[i] = { ...r[i], middleName: e.target.value }; setReferences(r); }} className="h-8 text-xs" placeholder="Middle Name" />
                    <Input value={row.familyName} onChange={(e) => { const r = [...references]; r[i] = { ...r[i], familyName: e.target.value }; setReferences(r); }} className="h-8 text-xs" placeholder="Family / Surname" />
                    <Input value={row.companyName} onChange={(e) => { const r = [...references]; r[i] = { ...r[i], companyName: e.target.value }; setReferences(r); }} className="h-8 text-xs" placeholder="Company Name" />
                    <Input value={row.address} onChange={(e) => { const r = [...references]; r[i] = { ...r[i], address: e.target.value }; setReferences(r); }} className="h-8 text-xs sm:col-span-2" placeholder="Address" />
                    <Input value={row.relationship} onChange={(e) => { const r = [...references]; r[i] = { ...r[i], relationship: e.target.value }; setReferences(r); }} className="h-8 text-xs" placeholder="Relationship" />
                    <Input value={row.residenceTel} onChange={(e) => { const r = [...references]; r[i] = { ...r[i], residenceTel: e.target.value }; setReferences(r); }} className="h-8 text-xs" placeholder="Residence Tel." />
                    <Input value={row.mobileTel} onChange={(e) => { const r = [...references]; r[i] = { ...r[i], mobileTel: e.target.value }; setReferences(r); }} className="h-8 text-xs" placeholder="Mobile Tel." />
                  </div>
                ))}
              </div>
            </div>

            {/* Professional Qualifications */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Professional Qualifications</p>
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 px-1">
                  <span>Institute / Board</span><span>Examination Passed</span><span>Year</span><span>%/Grade</span>
                </div>
                {professionalQuals.map((row, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-center">
                    <Input value={row.institute} onChange={(e) => { const r = [...professionalQuals]; r[i] = { ...r[i], institute: e.target.value }; setProfessionalQuals(r); }} className="h-8 text-xs" placeholder="Institute name" />
                    <Input value={row.exam} onChange={(e) => { const r = [...professionalQuals]; r[i] = { ...r[i], exam: e.target.value }; setProfessionalQuals(r); }} className="h-8 text-xs" placeholder="e.g. PMP" />
                    <Input value={row.year} onChange={(e) => { const r = [...professionalQuals]; r[i] = { ...r[i], year: e.target.value }; setProfessionalQuals(r); }} className="h-8 text-xs" placeholder="2020" />
                    <div className="flex items-center gap-1">
                      <Input value={row.percentage} onChange={(e) => { const r = [...professionalQuals]; r[i] = { ...r[i], percentage: e.target.value }; setProfessionalQuals(r); }} className="h-8 text-xs" placeholder="75%" />
                      {professionalQuals.length > 1 && (
                        <button onClick={() => setProfessionalQuals(professionalQuals.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="text-xs text-teal-600"
                  onClick={() => setProfessionalQuals([...professionalQuals, { institute: "", exam: "", year: "", percentage: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Row
                </Button>
              </div>
            </div>

            {/* Languages */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Languages</p>
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 px-1">
                  <span>Language</span><span>Read</span><span>Write</span><span>Speak</span>
                </div>
                {languages.map((row, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-center">
                    <Input value={row.language} onChange={(e) => { const r = [...languages]; r[i] = { ...r[i], language: e.target.value }; setLanguages(r); }} className="h-8 text-xs" placeholder="e.g. English" />
                    <Input value={row.read} onChange={(e) => { const r = [...languages]; r[i] = { ...r[i], read: e.target.value }; setLanguages(r); }} className="h-8 text-xs" placeholder="B/I/F" />
                    <Input value={row.write} onChange={(e) => { const r = [...languages]; r[i] = { ...r[i], write: e.target.value }; setLanguages(r); }} className="h-8 text-xs" placeholder="B/I/F" />
                    <div className="flex items-center gap-1">
                      <Input value={row.speak} onChange={(e) => { const r = [...languages]; r[i] = { ...r[i], speak: e.target.value }; setLanguages(r); }} className="h-8 text-xs" placeholder="B/I/F" />
                      {languages.length > 1 && (
                        <button onClick={() => setLanguages(languages.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="text-xs text-teal-600"
                  onClick={() => setLanguages([...languages, { language: "", read: "", write: "", speak: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Row
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Interests &amp; Career</p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {af("hobbies", "Interest in sports / hobbies")}
                  {af("achievement", "A significant achievement in your career")}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Career Objective</Label>
                  <textarea rows={2} value={formData.careerObjective} onChange={(e) => setFormData({ ...formData, careerObjective: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Strengths and areas of improvement (3 points)</Label>
                  <textarea rows={3} value={appFormData.strengths} onChange={(e) => setAppFormData({ ...appFormData, strengths: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Why do you consider yourself suitable for this position?</Label>
                  <textarea rows={2} value={appFormData.suitability} onChange={(e) => setAppFormData({ ...appFormData, suitability: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">A Few More Questions</p>
              <div className="space-y-4">
                {([
                  { key: "recentOperation" as keyof AppFormData, detailKey: "recentOperationDetails" as keyof AppFormData, label: "Did you have any operation in the recent past?" },
                  { key: "relativeInCompany" as keyof AppFormData, detailKey: "relativeInCompanyDetails" as keyof AppFormData, label: "Is any relative or acquaintance working in this company?" },
                ]).map(({ key, detailKey, label }) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-start gap-4">
                      <p className="text-sm text-gray-700 flex-1">{label}</p>
                      <div className="flex gap-3 shrink-0">
                        {["Yes", "No"].map((opt) => (
                          <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name={key} value={opt} checked={appFormData[key] === opt}
                              onChange={() => setAppFormData({ ...appFormData, [key]: opt })} className="accent-teal-600" />
                            <span className="text-sm">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {appFormData[key] === "Yes" && (
                      <div className="ml-4">
                        <Label className="text-xs text-gray-600">Please provide details</Label>
                        <textarea rows={2} value={appFormData[detailKey]} onChange={(e) => setAppFormData({ ...appFormData, [detailKey]: e.target.value })}
                          className="w-full mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Enclosed Herewith</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ENCLOSURE_ITEMS.map((item) => (
                  <label key={item} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={enclosures.includes(item)}
                      onChange={(e) => setEnclosures(e.target.checked ? [...enclosures, item] : enclosures.filter((i) => i !== item))}
                      className="h-4 w-4 accent-teal-600"
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleAppFormSave}
                  disabled={submittingAppForm}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {submittingAppForm && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save
                </Button>
                <Button
                  onClick={handleAppFormDownload}
                  disabled={downloadingAppForm}
                  variant="outline"
                  className="border-teal-600 text-teal-700 hover:bg-teal-50"
                >
                  {downloadingAppForm ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                  Download Application Form
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAppForm(false)}>Cancel</Button>
              </div>
              {appFormSaveError && <p className="text-xs text-red-600">{appFormSaveError}</p>}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Statutory / HR Forms ── */}
      {statFormSection(
        "bank",
        "Bank Details Form",
        "Uses your bank details from the Employee Information Form above — add the account type, then save & download.",
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sSel("bankAccountType", "Account Type", ["Savings", "Current"])}
        </div>,
        () => handleStatFormSave("bank"),
        async () => {
          const { BankDetailsPdfDocument } = await import("@/components/bank-details-pdf-document");
          await handleStatFormDownload("bank", `Bank-Details-${employee.employeeCode}.pdf`, () => (
            <BankDetailsPdfDocument data={{ employeeCode: employee.employeeCode, department: employee.department, designation: employee.designation, formData, appFormData, statutoryData }} />
          ));
        }
      )}

      {statFormSection(
        "confidentiality",
        "Declaration of Confidentiality & Impartiality",
        "The declaration text and your name/designation are filled in automatically — just set the date.",
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sf("confidentialityDate", "Date", "date")}
        </div>,
        () => handleStatFormSave("confidentiality"),
        async () => {
          const { ConfidentialityDeclarationPdfDocument } = await import("@/components/confidentiality-declaration-pdf-document");
          await handleStatFormDownload("confidentiality", `Confidentiality-Declaration-${employee.employeeCode}.pdf`, () => (
            <ConfidentialityDeclarationPdfDocument data={{ employeeCode: employee.employeeCode, department: employee.department, designation: employee.designation, formData, statutoryData }} />
          ));
        }
      )}

      {statFormSection(
        "formA",
        "PF Form A",
        "Employees' Provident Fund declaration — a few extra details, then save & download.",
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sf("formADate", "Date", "date")}
          {sSel("natureOfAppointment", "Nature of Appointment", ["Permanent", "Temporary", "Probationer", "Contractual", "Badli"])}
          {sf("salaryPerMensem", "Salary per Mensem (₹)", "number")}
        </div>,
        () => handleStatFormSave("formA"),
        async () => {
          const { FormAPdfDocument } = await import("@/components/form-a-pdf-document");
          await handleStatFormDownload("formA", `PF-Form-A-${employee.employeeCode}.pdf`, () => (
            <FormAPdfDocument data={{ employeeCode: employee.employeeCode, department: employee.department, designation: employee.designation, recruitmentEntity: employee.candidate.recruitmentEntity, formData, statutoryData }} />
          ));
        }
      )}

      {statFormSection(
        "formB",
        "PF Form B — Nomination",
        "Staff Provident Fund nomination — add your nominee(s) below, then save & download.",
        <>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Additional Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {formData.maritalStatus === "Married" && sf("husbandName", "Husband's Name")}
              {sf("pfNomineeVillage", "Village")}
              {sf("pfNomineeThana", "Thana")}
              {sf("pfNomineePostOffice", "Post Office")}
              {sf("pfNomineeDistrict", "District")}
              {sf("pfNomineeState", "State")}
              {sf("formBDate", "Date", "date")}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Nominee(s)</p>
            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-2 text-xs font-medium text-gray-500 px-1">
                <span>Name</span><span>Address</span><span>Relationship</span><span>Age</span><span>Share (%)</span><span></span>
              </div>
              {pfNominees.map((row, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 items-center">
                  <Input value={row.name} onChange={(e) => { const r = [...pfNominees]; r[i] = { ...r[i], name: e.target.value }; setPfNominees(r); }} className="h-8 text-xs" placeholder="Name" />
                  <Input value={row.address} onChange={(e) => { const r = [...pfNominees]; r[i] = { ...r[i], address: e.target.value }; setPfNominees(r); }} className="h-8 text-xs" placeholder="Address" />
                  <Input value={row.relationship} onChange={(e) => { const r = [...pfNominees]; r[i] = { ...r[i], relationship: e.target.value }; setPfNominees(r); }} className="h-8 text-xs" placeholder="Relationship" />
                  <Input value={row.age} onChange={(e) => { const r = [...pfNominees]; r[i] = { ...r[i], age: e.target.value }; setPfNominees(r); }} className="h-8 text-xs" placeholder="Age" />
                  <div className="flex items-center gap-1">
                    <Input value={row.share} onChange={(e) => { const r = [...pfNominees]; r[i] = { ...r[i], share: e.target.value }; setPfNominees(r); }} className="h-8 text-xs" placeholder="e.g. 50%" />
                    {pfNominees.length > 1 && (
                      <button onClick={() => setPfNominees(pfNominees.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs text-teal-600"
                onClick={() => setPfNominees([...pfNominees, { name: "", address: "", relationship: "", age: "", share: "" }])}>
                <Plus className="h-3 w-3 mr-1" /> Add Nominee
              </Button>
            </div>
          </div>
        </>,
        () => handleStatFormSave("formB"),
        async () => {
          const { FormBPdfDocument } = await import("@/components/form-b-pdf-document");
          await handleStatFormDownload("formB", `PF-Form-B-${employee.employeeCode}.pdf`, () => (
            <FormBPdfDocument data={{ employeeCode: employee.employeeCode, department: employee.department, designation: employee.designation, recruitmentEntity: employee.candidate.recruitmentEntity, formData, statutoryData, pfNominees }} />
          ));
        }
      )}

      {statFormSection(
        "form1Esic",
        "ESIC Form 1 — Declaration",
        "Employees' State Insurance declaration — a few extra details and family particulars, then save & download.",
        <>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Insurance Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sf("insuranceNumber", "Insurance Number (if any)")}
              {sf("previousInsuranceNo", "Previous Insurance No.")}
              {sf("previousEmployerCode", "Previous Employer's Code No.")}
              {sf("previousEmployerNameAddress", "Previous Employer — Name & Address")}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Family Particulars</p>
            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-2 text-xs font-medium text-gray-500 px-1">
                <span>Name</span><span>DOB</span><span>Relationship</span><span>Residing with you?</span><span>Place of Residence</span><span></span>
              </div>
              {esicFamilyMembers.map((row, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 items-center">
                  <Input value={row.name} onChange={(e) => { const r = [...esicFamilyMembers]; r[i] = { ...r[i], name: e.target.value }; setEsicFamilyMembers(r); }} className="h-8 text-xs" placeholder="Name" />
                  <Input type="date" value={row.dob} onChange={(e) => { const r = [...esicFamilyMembers]; r[i] = { ...r[i], dob: e.target.value }; setEsicFamilyMembers(r); }} className="h-8 text-xs" />
                  <Input value={row.relationship} onChange={(e) => { const r = [...esicFamilyMembers]; r[i] = { ...r[i], relationship: e.target.value }; setEsicFamilyMembers(r); }} className="h-8 text-xs" placeholder="e.g. Spouse" />
                  <select value={row.residingWithEmployee} onChange={(e) => { const r = [...esicFamilyMembers]; r[i] = { ...r[i], residingWithEmployee: e.target.value }; setEsicFamilyMembers(r); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                    <option value="">Select…</option><option value="Yes">Yes</option><option value="No">No</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <Input value={row.placeOfResidence} onChange={(e) => { const r = [...esicFamilyMembers]; r[i] = { ...r[i], placeOfResidence: e.target.value }; setEsicFamilyMembers(r); }} className="h-8 text-xs" placeholder="Place" />
                    {esicFamilyMembers.length > 1 && (
                      <button onClick={() => setEsicFamilyMembers(esicFamilyMembers.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs text-teal-600"
                onClick={() => setEsicFamilyMembers([...esicFamilyMembers, { name: "", dob: "", relationship: "", residingWithEmployee: "", placeOfResidence: "" }])}>
                <Plus className="h-3 w-3 mr-1" /> Add Family Member
              </Button>
            </div>
          </div>
        </>,
        () => handleStatFormSave("form1Esic"),
        async () => {
          const { Form1EsicPdfDocument } = await import("@/components/form1-esic-pdf-document");
          await handleStatFormDownload("form1Esic", `ESIC-Form-1-${employee.employeeCode}.pdf`, () => (
            <Form1EsicPdfDocument data={{ employeeCode: employee.employeeCode, department: employee.department, designation: employee.designation, recruitmentEntity: employee.candidate.recruitmentEntity, formData, statutoryData, esicFamilyMembers }} />
          ));
        }
      )}

      {statFormSection(
        "form11",
        "EPFO Form 11 — Composite Declaration",
        "Provident Fund transfer declaration — previous PF/Pension membership and employment history, then save & download.",
        <>
          <div className="space-y-3">
            {sYesNo("previousPfMember", "Were you a member of the Employees' Provident Fund Scheme, 1952 earlier?")}
            {sYesNo("previousPensionMember", "Were you a member of the Employees' Pension Scheme, 1995 earlier?")}
            {sYesNo("isInternationalWorker", "Are you an International Worker?")}
            {statutoryData.isInternationalWorker === "Yes" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 ml-4">
                {sf("countryOfOrigin", "Country of Origin")}
              </div>
            )}
          </div>
          {(statutoryData.previousPfMember === "Yes" || statutoryData.previousPensionMember === "Yes") && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Previous Employment (PF/Pension) Details</p>
              <div className="space-y-2">
                <div className="grid grid-cols-8 gap-2 text-xs font-medium text-gray-500 px-1">
                  <span className="col-span-2">Establishment Name &amp; Address</span><span>UAN</span><span>PF No.</span><span>Joined</span><span>Exited</span><span>Scheme Cert.</span><span>PPO No.</span>
                </div>
                {previousPfEmployment.map((row, i) => (
                  <div key={i} className="grid grid-cols-8 gap-2 items-center">
                    <Input value={row.establishment} onChange={(e) => { const r = [...previousPfEmployment]; r[i] = { ...r[i], establishment: e.target.value }; setPreviousPfEmployment(r); }} className="h-8 text-xs col-span-2" placeholder="Establishment" />
                    <Input value={row.uan} onChange={(e) => { const r = [...previousPfEmployment]; r[i] = { ...r[i], uan: e.target.value }; setPreviousPfEmployment(r); }} className="h-8 text-xs" placeholder="UAN" />
                    <Input value={row.pfNumber} onChange={(e) => { const r = [...previousPfEmployment]; r[i] = { ...r[i], pfNumber: e.target.value }; setPreviousPfEmployment(r); }} className="h-8 text-xs" placeholder="PF No." />
                    <Input type="date" value={row.dateOfJoining} onChange={(e) => { const r = [...previousPfEmployment]; r[i] = { ...r[i], dateOfJoining: e.target.value }; setPreviousPfEmployment(r); }} className="h-8 text-xs" />
                    <Input type="date" value={row.dateOfExit} onChange={(e) => { const r = [...previousPfEmployment]; r[i] = { ...r[i], dateOfExit: e.target.value }; setPreviousPfEmployment(r); }} className="h-8 text-xs" />
                    <Input value={row.schemeCertNo} onChange={(e) => { const r = [...previousPfEmployment]; r[i] = { ...r[i], schemeCertNo: e.target.value }; setPreviousPfEmployment(r); }} className="h-8 text-xs" placeholder="Scheme Cert." />
                    <div className="flex items-center gap-1">
                      <Input value={row.ppoNumber} onChange={(e) => { const r = [...previousPfEmployment]; r[i] = { ...r[i], ppoNumber: e.target.value }; setPreviousPfEmployment(r); }} className="h-8 text-xs" placeholder="PPO No." />
                      {previousPfEmployment.length > 1 && (
                        <button onClick={() => setPreviousPfEmployment(previousPfEmployment.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="text-xs text-teal-600"
                  onClick={() => setPreviousPfEmployment([...previousPfEmployment, { establishment: "", uan: "", pfNumber: "", dateOfJoining: "", dateOfExit: "", schemeCertNo: "", ppoNumber: "", ncpDays: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Row
                </Button>
              </div>
            </div>
          )}
        </>,
        () => handleStatFormSave("form11"),
        async () => {
          const { Form11PdfDocument } = await import("@/components/form11-pdf-document");
          await handleStatFormDownload("form11", `EPFO-Form-11-${employee.employeeCode}.pdf`, () => (
            <Form11PdfDocument data={{ employeeCode: employee.employeeCode, department: employee.department, designation: employee.designation, formData, statutoryData, previousPfEmployment }} />
          ));
        }
      )}

      {statFormSection(
        "form12bb",
        "Consent Letter & Form 12BB — Tax Declaration",
        "Income tax regime consent and investment declaration for the financial year, then save & download.",
        <>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Tax Regime</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sf("financialYear", "Financial Year (e.g. 2026-2027)")}
              {sSel("taxRegime", "Tax Regime Opted", ["Old Regime", "New Regime"])}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">House Rent Allowance</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sf("rentPaidToLandlord", "Rent Paid (₹ per annum)", "number")}
              {sf("landlordName", "Landlord's Name")}
              {sf("landlordAddress", "Landlord's Address")}
              {sf("landlordPAN", "Landlord's PAN (if rent > ₹1,00,000/yr)")}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Leave Travel Concession &amp; Home Loan Interest</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sf("ltcAmount", "LTC Amount Claimed (₹)", "number")}
              {sf("homeLoanInterest", "Home Loan Interest (₹)", "number")}
              {sf("lenderName", "Lender's Name")}
              {sf("lenderAddress", "Lender's Address")}
              {sf("lenderPAN", "Lender's PAN")}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Chapter VI-A Deductions (80C, 80D, 80E, 80G, etc.)</p>
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 px-1">
                <span>Section</span><span>Particulars</span><span>Amount (₹)</span><span></span>
              </div>
              {chapter6ADeductions.map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 items-center">
                  <Input value={row.section} onChange={(e) => { const r = [...chapter6ADeductions]; r[i] = { ...r[i], section: e.target.value }; setChapter6ADeductions(r); }} className="h-8 text-xs" placeholder="e.g. 80C" />
                  <Input value={row.particulars} onChange={(e) => { const r = [...chapter6ADeductions]; r[i] = { ...r[i], particulars: e.target.value }; setChapter6ADeductions(r); }} className="h-8 text-xs" placeholder="e.g. LIC Premium" />
                  <div className="flex items-center gap-1">
                    <Input value={row.amount} onChange={(e) => { const r = [...chapter6ADeductions]; r[i] = { ...r[i], amount: e.target.value }; setChapter6ADeductions(r); }} className="h-8 text-xs" placeholder="Amount" />
                    {chapter6ADeductions.length > 1 && (
                      <button onClick={() => setChapter6ADeductions(chapter6ADeductions.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs text-teal-600"
                onClick={() => setChapter6ADeductions([...chapter6ADeductions, { section: "", particulars: "", amount: "" }])}>
                <Plus className="h-3 w-3 mr-1" /> Add Row
              </Button>
            </div>
          </div>
        </>,
        () => handleStatFormSave("form12bb"),
        async () => {
          const { ConsentForm12BBPdfDocument } = await import("@/components/consent-form12bb-pdf-document");
          await handleStatFormDownload("form12bb", `Consent-Form-12BB-${employee.employeeCode}.pdf`, () => (
            <ConsentForm12BBPdfDocument data={{ employeeCode: employee.employeeCode, department: employee.department, designation: employee.designation, recruitmentEntity: employee.candidate.recruitmentEntity, formData, statutoryData, chapter6ADeductions }} />
          ));
        }
      )}

      {statFormSection(
        "gratuityF",
        "Gratuity Nomination (Form F)",
        "Payment of Gratuity Act nomination — add your nominee(s) below, then save & download.",
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sf("gratuityDate", "Date", "date")}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Nominee(s)</p>
            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-2 text-xs font-medium text-gray-500 px-1">
                <span>Name</span><span>Address</span><span>Relationship</span><span>Age</span><span>Proportion (%)</span><span></span>
              </div>
              {gratuityNominees.map((row, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 items-center">
                  <Input value={row.name} onChange={(e) => { const r = [...gratuityNominees]; r[i] = { ...r[i], name: e.target.value }; setGratuityNominees(r); }} className="h-8 text-xs" placeholder="Name" />
                  <Input value={row.address} onChange={(e) => { const r = [...gratuityNominees]; r[i] = { ...r[i], address: e.target.value }; setGratuityNominees(r); }} className="h-8 text-xs" placeholder="Address" />
                  <Input value={row.relationship} onChange={(e) => { const r = [...gratuityNominees]; r[i] = { ...r[i], relationship: e.target.value }; setGratuityNominees(r); }} className="h-8 text-xs" placeholder="Relationship" />
                  <Input value={row.age} onChange={(e) => { const r = [...gratuityNominees]; r[i] = { ...r[i], age: e.target.value }; setGratuityNominees(r); }} className="h-8 text-xs" placeholder="Age" />
                  <div className="flex items-center gap-1">
                    <Input value={row.proportion} onChange={(e) => { const r = [...gratuityNominees]; r[i] = { ...r[i], proportion: e.target.value }; setGratuityNominees(r); }} className="h-8 text-xs" placeholder="e.g. 100%" />
                    {gratuityNominees.length > 1 && (
                      <button onClick={() => setGratuityNominees(gratuityNominees.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs text-teal-600"
                onClick={() => setGratuityNominees([...gratuityNominees, { name: "", address: "", relationship: "", age: "", proportion: "" }])}>
                <Plus className="h-3 w-3 mr-1" /> Add Nominee
              </Button>
            </div>
          </div>
        </>,
        () => handleStatFormSave("gratuityF"),
        async () => {
          const { GratuityFormFPdfDocument } = await import("@/components/gratuity-form-f-pdf-document");
          await handleStatFormDownload("gratuityF", `Gratuity-Form-F-${employee.employeeCode}.pdf`, () => (
            <GratuityFormFPdfDocument data={{ employeeCode: employee.employeeCode, department: employee.department, designation: employee.designation, recruitmentEntity: employee.candidate.recruitmentEntity, formData, statutoryData, gratuityNominees }} />
          ));
        }
      )}

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
    </div>
  );
}
