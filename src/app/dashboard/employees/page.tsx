"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, UserCheck, Eye, FileText, ClipboardList } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Branch { id: string; name: string; code: string }

interface Employee {
  id: string;
  candidateId: string;
  employeeCode: string;
  joiningDate: string;
  department: string | null;
  designation: string | null;
  ctc: number | null;
  reportingTo: string | null;
  isActive: boolean;
  onboardingStep: number;
  candidate: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    mrf: { department: { name: string } } | null;
  };
  branch: { name: string } | null;
}

interface JoinedCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  currentStage: string;
  employee: null | { id: string };
}

interface OnboardingDoc {
  id: string;
  name: string;
  fileUrl: string;
  documentType: string;
  approvalStatus: string;
  extractedData: string | null;
  createdAt: string;
}

interface OnboardingFormData {
  formData: Record<string, string>;
  education: Array<Record<string, string>>;
  employment: Array<Record<string, string>>;
  submittedAt: string;
}

const FIELD_LABELS: Record<string, string> = {
  // Identity
  salutation: "Salutation", firstName: "First Name", middleName: "Middle Name", lastName: "Last Name",
  fatherFirstName: "Father's First Name", fatherLastName: "Father's Last Name",
  // Personal
  dateOfBirth: "Date of Birth", dateOfJoining: "Date of Joining",
  gender: "Gender", maritalStatus: "Marital Status", religion: "Religion", bloodGroup: "Blood Group",
  // Family
  hasChildren: "Has Children", hasSpouse: "Has Spouse", spouseDateOfBirth: "Spouse DOB",
  // Contact
  presentAddress: "Present Address", presentPinCode: "Present PIN", presentMobile: "Mobile", presentEmail: "Email",
  permanentAddress: "Permanent Address", permanentPinCode: "Permanent PIN", permanentMobile: "Permanent Mobile",
  // Bank
  employeeNameAsPerBank: "Name (as per Bank)", bankName: "Bank Name", bankBranchName: "Bank Branch",
  bankAccountNumber: "Account Number", ifscCode: "IFSC Code",
  // Identity Docs
  aadhaarNumber: "Aadhaar Number", panNumber: "PAN Number", passportNumber: "Passport Number", esicNumber: "ESIC Card No.",
  // Emergency
  emergencyName: "Emergency Contact", emergencyRelationship: "Relationship", emergencyMobile: "Emergency Mobile",
  // Declarations
  everConvicted: "Convicted of criminal offence?", everConvictedDetails: "Conviction Details",
  drugAlcoholTreatment: "Drug/Alcohol treatment?", drugAlcoholDetails: "Drug/Alcohol Details",
  preExistingConditions: "Pre-existing conditions?", preExistingDetails: "Condition Details",
  physicalDefect: "Physical defect/disability?", physicalDefectDetails: "Defect Details",
  // Other
  careerObjective: "Career Objective", declarationDate: "Declaration Date",
  // Legacy keys
  emergencyContactName: "Emergency Contact", emergencyContactPhone: "Emergency Phone",
  bankName2: "Bank Name", aadhaarLast4: "Aadhaar (Last 4)",
  passportExpiry: "Passport Expiry", pfAccountNumber: "PF Account No.", esiNumber: "ESI No.",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [joinedCandidates, setJoinedCandidates] = useState<JoinedCandidate[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState({
    candidateId: "",
    joiningDate: "",
    department: "",
    designation: "",
    ctc: "",
    reportingTo: "",
    branchId: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Onboarding data view
  const [viewEmp, setViewEmp] = useState<Employee | null>(null);
  const [onboardingData, setOnboardingData] = useState<OnboardingFormData | null>(null);
  const [onboardingDocs, setOnboardingDocs] = useState<OnboardingDoc[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const fetchEmployees = () => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((d) => { setEmployees(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => {
    fetchEmployees();
    fetch("/api/org/branches").then((r) => r.json()).then((d) => setBranches(Array.isArray(d) ? d : []));
  }, []);

  const openAddDialog = async () => {
    const res = await fetch("/api/candidates?stage=JOINED");
    const all: JoinedCandidate[] = await res.json();
    const joined = (Array.isArray(all) ? all : []).filter(
      (c) => c.currentStage === "JOINED" && !c.employee
    );
    setJoinedCandidates(joined);
    setForm({ candidateId: "", joiningDate: "", department: "", designation: "", ctc: "", reportingTo: "", branchId: "" });
    setShowAdd(true);
  };

  const handleAdd = async () => {
    setSubmitting(true);
    await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ctc: form.ctc ? parseFloat(form.ctc) : null,
        branchId: form.branchId || null,
      }),
    });
    setSubmitting(false);
    setShowAdd(false);
    fetchEmployees();
  };

  const openView = async (emp: Employee) => {
    setViewEmp(emp);
    setOnboardingData(null);
    setOnboardingDocs([]);
    setViewLoading(true);

    const [dataRes, docsRes] = await Promise.all([
      fetch(`/api/employees/${emp.id}/onboarding-data`),
      fetch(`/api/documents?candidateId=${emp.candidateId}`),
    ]);

    if (dataRes.ok) {
      const d = await dataRes.json();
      if (d && d.formData) {
        // API returns { ...row, formData: parsedJSON }
        // parsedJSON contains { formData: {...}, education: [...], employment: [...] }
        const parsed = typeof d.formData === "object" ? d.formData : {};
        setOnboardingData({
          formData: parsed.formData || {},
          education: Array.isArray(parsed.education) ? parsed.education : [],
          employment: Array.isArray(parsed.employment) ? parsed.employment : [],
          submittedAt: d.submittedAt || d.updatedAt || "",
        });
      }
    }
    if (docsRes.ok) {
      const d = await docsRes.json();
      setOnboardingDocs(Array.isArray(d) ? d : []);
    }
    setViewLoading(false);
  };

  const STATUS_BADGE: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employees</h2>
          <p className="text-sm text-gray-500 mt-1">{employees.length} employee records</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-1" /> Add Employee
        </Button>
      </div>

      <Card>
        <CardHeader />
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>
          ) : employees.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <UserCheck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p>No employees yet. Convert a joined candidate to an employee record.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead>CTC</TableHead>
                  <TableHead>Onboarding</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono text-sm font-medium">{emp.employeeCode}</TableCell>
                    <TableCell>
                      <p className="font-medium">{emp.candidate.firstName} {emp.candidate.lastName}</p>
                      <p className="text-xs text-gray-500">{emp.candidate.email}</p>
                    </TableCell>
                    <TableCell>{emp.department || "—"}</TableCell>
                    <TableCell>{emp.designation || "—"}</TableCell>
                    <TableCell>{emp.branch?.name || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">{formatDate(emp.joiningDate)}</TableCell>
                    <TableCell className="text-sm">
                      {emp.ctc != null ? `₹${emp.ctc.toLocaleString("en-IN")}` : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        emp.onboardingStep >= 2 ? "bg-green-100 text-green-700" :
                        emp.onboardingStep === 1 ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {emp.onboardingStep >= 2 ? "Complete" : emp.onboardingStep === 1 ? "In Progress" : "Not Started"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openView(emp)} className="text-xs gap-1">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Employee Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Convert Candidate to Employee</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Candidate (Joined) *</Label>
              <Select value={form.candidateId} onValueChange={(v) => setForm({ ...form, candidateId: v })}>
                <SelectTrigger><SelectValue placeholder="Select candidate" /></SelectTrigger>
                <SelectContent>
                  {joinedCandidates.length === 0 ? (
                    <SelectItem value="__none" disabled>No joined candidates without employee record</SelectItem>
                  ) : (
                    joinedCandidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.email}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Joining Date *</Label>
              <Input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Operations" />
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Engineer" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>CTC (₹)</Label>
                <Input type="number" value={form.ctc} onChange={(e) => setForm({ ...form, ctc: e.target.value })} placeholder="e.g. 500000" />
              </div>
              <div className="space-y-2">
                <Label>Reporting To</Label>
                <Input value={form.reportingTo} onChange={(e) => setForm({ ...form, reportingTo: e.target.value })} placeholder="Manager name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                <SelectTrigger><SelectValue placeholder="Select branch (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.candidateId || !form.joiningDate || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Create Employee Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Employee Onboarding Dialog */}
      <Dialog open={!!viewEmp} onOpenChange={(o) => !o && setViewEmp(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewEmp ? `${viewEmp.candidate.firstName} ${viewEmp.candidate.lastName}` : "Employee"} — Onboarding Details
            </DialogTitle>
            {viewEmp && (
              <p className="text-sm text-gray-500">{viewEmp.employeeCode} · {viewEmp.candidate.email}</p>
            )}
          </DialogHeader>

          {viewLoading ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-5 py-2">
              {!onboardingData ? (
                <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                  Employee has not submitted the onboarding form yet.
                </div>
              ) : (
                <>
                  {/* Personal & contact fields grouped */}
                  {(() => {
                    const fd = onboardingData.formData;
                    const COMPLIANCE_KEYS = new Set(["everConvicted","everConvictedDetails","drugAlcoholTreatment","drugAlcoholDetails","preExistingConditions","preExistingDetails","physicalDefect","physicalDefectDetails"]);
                    const FAMILY_KEYS = new Set(["hasChildren","hasSpouse","spouseDateOfBirth"]);
                    const coreEntries = Object.entries(fd).filter(([k, v]) => v && !COMPLIANCE_KEYS.has(k) && !FAMILY_KEYS.has(k));
                    const familyEntries = Object.entries(fd).filter(([k, v]) => v && FAMILY_KEYS.has(k));
                    const complianceEntries = Object.entries(fd).filter(([k]) => COMPLIANCE_KEYS.has(k));

                    return (
                      <>
                        {coreEntries.length > 0 && (
                          <div className="rounded-lg border border-gray-200 p-3">
                            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Personal, Contact & Banking</p>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                              {coreEntries.map(([key, val]) => (
                                <div key={key}>
                                  <dt className="text-xs text-gray-400">{FIELD_LABELS[key] || key}</dt>
                                  <dd className="text-sm text-gray-800 font-medium">{val}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        )}

                        {familyEntries.length > 0 && (
                          <div className="rounded-lg border border-gray-200 p-3">
                            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Family Information</p>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                              {familyEntries.map(([key, val]) => (
                                <div key={key}>
                                  <dt className="text-xs text-gray-400">{FIELD_LABELS[key] || key}</dt>
                                  <dd className="text-sm text-gray-800 font-medium">{val}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        )}

                        {complianceEntries.some(([, v]) => v) && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs font-semibold text-amber-700 mb-2 uppercase">Compliance & Medical Declarations</p>
                            <dl className="space-y-2">
                              {complianceEntries.filter(([, v]) => v).map(([key, val]) => (
                                <div key={key} className={key.endsWith("Details") ? "ml-4" : ""}>
                                  <dt className="text-xs text-gray-500">{FIELD_LABELS[key] || key}</dt>
                                  <dd className={`text-sm font-medium ${val === "Yes" ? "text-red-700" : val === "No" ? "text-green-700" : "text-gray-800"}`}>{val}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Education */}
                  {onboardingData.education.filter(r => r.institute || r.exam).length > 0 && (
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Education</p>
                      <table className="w-full text-xs">
                        <thead><tr className="text-gray-400 border-b">
                          <th className="pb-1 text-left font-medium">Institute</th>
                          <th className="pb-1 text-left font-medium">Exam/Degree</th>
                          <th className="pb-1 text-left font-medium">Year</th>
                          <th className="pb-1 text-left font-medium">%</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-50">
                          {onboardingData.education.map((row, i) => (
                            <tr key={i}>
                              <td className="py-1 pr-2">{row.institute || "—"}</td>
                              <td className="py-1 pr-2">{row.exam || "—"}</td>
                              <td className="py-1 pr-2">{row.year || "—"}</td>
                              <td className="py-1">{row.percentage || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Employment */}
                  {onboardingData.employment.filter(r => r.employer).length > 0 && (
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Employment History</p>
                      <table className="w-full text-xs">
                        <thead><tr className="text-gray-400 border-b">
                          <th className="pb-1 text-left font-medium">Employer</th>
                          <th className="pb-1 text-left font-medium">From</th>
                          <th className="pb-1 text-left font-medium">To</th>
                          <th className="pb-1 text-left font-medium">Role</th>
                          <th className="pb-1 text-left font-medium">CTC</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-50">
                          {onboardingData.employment.map((row, i) => (
                            <tr key={i}>
                              <td className="py-1 pr-2">{row.employer || "—"}</td>
                              <td className="py-1 pr-2">{row.from || "—"}</td>
                              <td className="py-1 pr-2">{row.to || "—"}</td>
                              <td className="py-1 pr-2">{row.role || "—"}</td>
                              <td className="py-1">{row.lastCTC || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Uploaded Documents */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Uploaded Documents</h3>
                  <span className="text-xs text-gray-400">({onboardingDocs.length})</span>
                </div>
                {onboardingDocs.length === 0 ? (
                  <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                    No documents uploaded.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {onboardingDocs.map((doc) => (
                      <div key={doc.id} className="px-3 py-2 space-y-1">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline truncate block">{doc.name}</a>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">{doc.documentType.replace(/_/g, " ")}</span>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-gray-400">{formatDate(doc.createdAt)}</span>
                            </div>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${STATUS_BADGE[doc.approvalStatus] || "bg-gray-100 text-gray-600"}`}>
                            {doc.approvalStatus}
                          </span>
                        </div>
                        {doc.extractedData && (() => {
                          try {
                            const fields = JSON.parse(doc.extractedData);
                            const entries = Object.entries(fields);
                            if (!entries.length) return null;
                            return (
                              <div className="ml-7 bg-blue-50 rounded px-2 py-1.5 text-xs text-gray-600 space-y-0.5">
                                <p className="font-semibold text-blue-700 mb-0.5">Extracted Data</p>
                                {entries.map(([k, v]) => (
                                  <p key={k}><span className="text-gray-400 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}:</span> <span className="font-medium">{String(v)}</span></p>
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
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewEmp(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
