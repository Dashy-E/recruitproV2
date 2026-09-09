"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { OrgUnitPicker, OrgTreeNode } from "@/components/org-unit-picker";
import { toast } from "@/hooks/use-toast";

interface Department { id: string; name: string; designations: Designation[] }
interface Designation { id: string; title: string; requiresPsychometric: boolean }

// Only editable while nothing has been committed to the approval chain yet —
// a rejected MRF (restartable) or one still sitting at the very first stage
// (no one has acted on it, so nothing downstream depends on its details yet).
const EDITABLE_STATUSES = ["REJECTED", "PENDING_DIVISIONAL"];

export default function EditMRFPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] })?.permissions || [];
  const canManageMrf = permissions.includes("MANAGE_MRF");

  const [orgTree, setOrgTree] = useState<OrgTreeNode[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [selectedOrgUnit, setSelectedOrgUnit] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDesignation, setSelectedDesignation] = useState("");

  const [title, setTitle] = useState("");

  const [vacancyType, setVacancyType] = useState<"REPLACEMENT" | "NEW_POSITION" | "">("");
  const [replacementFor, setReplacementFor] = useState("");
  const [replacementReason, setReplacementReason] = useState("");
  const [replacedEmployeeName, setReplacedEmployeeName] = useState("");
  const [replacedEmployeeCTC, setReplacedEmployeeCTC] = useState("");
  const [replacementNecessityReason, setReplacementNecessityReason] = useState("");
  const [isNewRole, setIsNewRole] = useState(false);
  const [isBusinessExpansion, setIsBusinessExpansion] = useState(false);
  const [newRoleJustification, setNewRoleJustification] = useState("");

  const [isBudgeted, setIsBudgeted] = useState<boolean | null>(null);
  const [proposedGrade, setProposedGrade] = useState("");
  const [ctcRange, setCtcRange] = useState("");
  const [location, setLocation] = useState("");
  const [reportingTo, setReportingTo] = useState("");
  const [jobProfile, setJobProfile] = useState("");
  const [vacancyCount, setVacancyCount] = useState(1);

  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [minQualification, setMinQualification] = useState("");
  const [preferredQualification, setPreferredQualification] = useState("");
  const [workExperience, setWorkExperience] = useState("");
  const [industryBackground, setIndustryBackground] = useState("");
  const [otherSpecs, setOtherSpecs] = useState("");

  const [contributionJustified, setContributionJustified] = useState(false);

  const [fillerName, setFillerName] = useState("");
  const [fillerDesignation, setFillerDesignation] = useState("");

  const [status, setStatus] = useState<string | null>(null);
  const [loadingMrf, setLoadingMrf] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const designations = departments.find((d) => d.id === selectedDepartment)?.designations || [];

  useEffect(() => {
    fetch("/api/org-units/tree").then((r) => r.json()).then((d) => setOrgTree(Array.isArray(d) ? d : []));
    fetch("/api/org/departments").then((r) => r.json()).then((d) => setDepartments(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/mrfs/${id}`)
      .then((r) => r.json())
      .then((mrf) => {
        if (mrf.error) {
          setLoadError(mrf.error);
          return;
        }
        setStatus(mrf.status);
        setTitle(mrf.title || "");
        setSelectedOrgUnit(mrf.orgUnitId || "");
        setSelectedDepartment(mrf.departmentId || "");
        setSelectedDesignation(mrf.designationId || "");
        setVacancyType(mrf.vacancyType || "");
        setReplacementFor(mrf.replacementFor || "");
        setReplacementReason(mrf.replacementReason || "");
        setReplacedEmployeeName(mrf.replacedEmployeeName || "");
        setReplacedEmployeeCTC(mrf.replacedEmployeeCTC || "");
        setReplacementNecessityReason(mrf.replacementNecessityReason || "");
        setIsNewRole(!!mrf.isNewRole);
        setIsBusinessExpansion(!!mrf.isBusinessExpansion);
        setNewRoleJustification(mrf.newRoleJustification || "");
        setIsBudgeted(mrf.isBudgeted === null || mrf.isBudgeted === undefined ? null : !!mrf.isBudgeted);
        setProposedGrade(mrf.proposedGrade || "");
        setCtcRange(mrf.ctcRange || "");
        setLocation(mrf.location || "");
        setReportingTo(mrf.reportingTo || "");
        setJobProfile(mrf.jobProfile || "");
        setVacancyCount(mrf.vacancyCount || 1);
        setMinAge(mrf.minAge != null ? String(mrf.minAge) : "");
        setMaxAge(mrf.maxAge != null ? String(mrf.maxAge) : "");
        setMinQualification(mrf.minQualification || "");
        setPreferredQualification(mrf.preferredQualification || "");
        setWorkExperience(mrf.workExperience || "");
        setIndustryBackground(mrf.industryBackground || "");
        setOtherSpecs(mrf.otherSpecs || "");
        setContributionJustified(!!mrf.contributionJustified);
        setFillerName(mrf.fillerName || "");
        setFillerDesignation(mrf.fillerDesignation || "");
      })
      .catch(() => setLoadError("Failed to load MRF."))
      .finally(() => setLoadingMrf(false));
  }, [id]);

  const isValid = () => {
    if (!title || !selectedOrgUnit || !selectedDepartment) return false;
    if (!vacancyType) return false;
    if (!ctcRange.trim()) return false;
    if (!fillerName.trim() || !fillerDesignation.trim()) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isValid()) {
      setError("Please complete all required fields.");
      return;
    }
    setSaving(true);

    const payload = {
      title,
      orgUnitId: selectedOrgUnit,
      departmentId: selectedDepartment,
      designationId: selectedDesignation || null,
      vacancyCount,
      vacancyType,
      replacementFor: vacancyType === "REPLACEMENT" ? replacementFor : null,
      replacementReason: vacancyType === "REPLACEMENT" ? replacementReason : null,
      replacedEmployeeName: vacancyType === "REPLACEMENT" ? replacedEmployeeName : null,
      replacedEmployeeCTC: vacancyType === "REPLACEMENT" ? replacedEmployeeCTC : null,
      replacementNecessityReason: vacancyType === "REPLACEMENT" ? replacementNecessityReason : null,
      isNewRole: vacancyType === "NEW_POSITION" ? isNewRole : false,
      isBusinessExpansion: vacancyType === "NEW_POSITION" ? isBusinessExpansion : false,
      newRoleJustification: vacancyType === "NEW_POSITION" ? newRoleJustification : null,
      isBudgeted,
      proposedGrade: proposedGrade || null,
      ctcRange: ctcRange || null,
      location: location || null,
      reportingTo: reportingTo || null,
      jobProfile: jobProfile || null,
      minAge: minAge ? parseInt(minAge) : null,
      maxAge: maxAge ? parseInt(maxAge) : null,
      minQualification: minQualification || null,
      preferredQualification: preferredQualification || null,
      workExperience: workExperience || null,
      industryBackground: industryBackground || null,
      otherSpecs: otherSpecs || null,
      contributionJustified,
      fillerName,
      fillerDesignation,
    };

    const res = await fetch(`/api/mrfs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (res.ok) {
      toast({ variant: "success", title: "MRF updated" });
      router.push(`/dashboard/mrfs/${id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update MRF.");
    }
  };

  if (loadingMrf) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-red-600">{loadError}</p>
        <Link href={`/dashboard/mrfs/${id}`} className="text-sm text-blue-600 hover:underline">Back to MRF</Link>
      </div>
    );
  }

  if (!canManageMrf || !EDITABLE_STATUSES.includes(status || "")) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-gray-600">
          This MRF can no longer be edited — it has already moved past the first approval stage.
        </p>
        <Link href={`/dashboard/mrfs/${id}`} className="text-sm text-blue-600 hover:underline">Back to MRF</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/mrfs/${id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Edit Manpower Requisition Form</h2>
          <p className="text-sm text-gray-500">Update the details below and save your changes</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        <Card>
          <CardHeader><CardTitle>MRF Reference</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">MRF Title / Internal Reference *</Label>
              <Input
                id="title"
                placeholder="e.g. Engineer – Gandhidham Operations"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Section 1 – Location</CardTitle>
            <p className="text-sm text-gray-500">Select the org unit this requisition belongs to</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Org Unit *</Label>
              <OrgUnitPicker nodes={orgTree} mode="single" value={selectedOrgUnit} onChange={(v) => setSelectedOrgUnit(v as string)} leafOnly />
              <p className="text-xs text-gray-500">Only specific locations can be selected — pick the most specific node (a unit with no further sub-locations).</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Section 2 – Vacancy Type *</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="vacancyType"
                  value="REPLACEMENT"
                  checked={vacancyType === "REPLACEMENT"}
                  onChange={() => setVacancyType("REPLACEMENT")}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">Replacement</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="vacancyType"
                  value="NEW_POSITION"
                  checked={vacancyType === "NEW_POSITION"}
                  onChange={() => setVacancyType("NEW_POSITION")}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">New Position</span>
              </label>
            </div>

            {vacancyType === "REPLACEMENT" && (
              <div className="space-y-4 border-l-2 border-gray-200 pl-4">
                <div className="space-y-2">
                  <Label>For (employee name)</Label>
                  <Input value={replacementFor} onChange={(e) => setReplacementFor(e.target.value)} placeholder="Name of employee being replaced" />
                </div>
                <div className="space-y-2">
                  <Label>Reason for Replacement</Label>
                  <Select value={replacementReason} onValueChange={setReplacementReason}>
                    <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RESIGNATION">Resignation</SelectItem>
                      <SelectItem value="TRANSFER">Transfer</SelectItem>
                      <SelectItem value="RETIREMENT">Retirement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Name of resigned employee with CTC</Label>
                  <Input value={replacedEmployeeName} onChange={(e) => setReplacedEmployeeName(e.target.value)} placeholder="e.g. John Doe – ₹6,00,000 p.a." />
                </div>
                <div className="space-y-2">
                  <Label>CTC of replaced employee</Label>
                  <Input value={replacedEmployeeCTC} onChange={(e) => setReplacedEmployeeCTC(e.target.value)} placeholder="e.g. ₹6,00,000" />
                </div>
                <div className="space-y-2">
                  <Label>State the reason why replacement is necessary</Label>
                  <Textarea rows={3} value={replacementNecessityReason} onChange={(e) => setReplacementNecessityReason(e.target.value)} placeholder="Explain the operational necessity..." />
                </div>
              </div>
            )}

            {vacancyType === "NEW_POSITION" && (
              <div className="space-y-4 border-l-2 border-gray-200 pl-4">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isNewRole}
                    onChange={(e) => setIsNewRole(e.target.checked)}
                    className="h-4 w-4 mt-0.5"
                  />
                  <span className="text-sm">New role (new responsibilities/skills has been identified)</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBusinessExpansion}
                    onChange={(e) => setIsBusinessExpansion(e.target.checked)}
                    className="h-4 w-4 mt-0.5"
                  />
                  <span className="text-sm">Business expansion (volume of work has increased)</span>
                </label>
                <div className="space-y-2">
                  <Label>Substantiate with suitable justification</Label>
                  <Textarea rows={3} value={newRoleJustification} onChange={(e) => setNewRoleJustification(e.target.value)} placeholder="Provide justification for the new position..." />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Section 3 – Position Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-6 items-center">
              <Label className="shrink-0">Budgeted</Label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="isBudgeted" checked={isBudgeted === true} onChange={() => setIsBudgeted(true)} className="h-4 w-4" />
                <span className="text-sm">Yes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="isBudgeted" checked={isBudgeted === false} onChange={() => setIsBudgeted(false)} className="h-4 w-4" />
                <span className="text-sm">No</span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Department *</Label>
                <Select value={selectedDepartment} onValueChange={(v) => { setSelectedDepartment(v); setSelectedDesignation(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Designation (Proposed)</Label>
                <Select value={selectedDesignation} onValueChange={setSelectedDesignation} disabled={!selectedDepartment}>
                  <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
                  <SelectContent>
                    {designations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Grade</Label>
                <Input value={proposedGrade} onChange={(e) => setProposedGrade(e.target.value)} placeholder="e.g. M3" />
              </div>
              <div className="space-y-2">
                <Label>CTC Range *</Label>
                <Input value={ctcRange} onChange={(e) => setCtcRange(e.target.value)} placeholder="e.g. ₹5–7 LPA" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Branch or specific location" />
              </div>
              <div className="space-y-2">
                <Label>Reporting To</Label>
                <Input value={reportingTo} onChange={(e) => setReportingTo(e.target.value)} placeholder="Name / designation" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Job Profile</Label>
              <Textarea rows={3} value={jobProfile} onChange={(e) => setJobProfile(e.target.value)} placeholder="Key responsibilities and role overview..." />
            </div>

            <div className="space-y-2">
              <Label>Number of Vacancies *</Label>
              <Input
                type="number"
                min={1}
                value={String(vacancyCount)}
                onChange={(e) => {
                  const n = parseInt(e.target.value);
                  setVacancyCount(isNaN(n) || n < 1 ? 1 : n);
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Section 4 – Candidate Specifications</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Min Age</Label>
                <Input type="number" value={minAge} onChange={(e) => setMinAge(e.target.value)} placeholder="e.g. 22" />
              </div>
              <div className="space-y-2">
                <Label>Max Age</Label>
                <Input type="number" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} placeholder="e.g. 35" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Min Qualification</Label>
                <Input value={minQualification} onChange={(e) => setMinQualification(e.target.value)} placeholder="e.g. B.Sc. / Diploma" />
              </div>
              <div className="space-y-2">
                <Label>Preferred Qualification</Label>
                <Input value={preferredQualification} onChange={(e) => setPreferredQualification(e.target.value)} placeholder="e.g. M.Sc. / B.Tech" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Work Experience</Label>
                <Input value={workExperience} onChange={(e) => setWorkExperience(e.target.value)} placeholder="e.g. 3–5 years" />
              </div>
              <div className="space-y-2">
                <Label>Industry Background</Label>
                <Input value={industryBackground} onChange={(e) => setIndustryBackground(e.target.value)} placeholder="e.g. Oil & Gas, Chemical" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Any Other Specifications</Label>
              <Input value={otherSpecs} onChange={(e) => setOtherSpecs(e.target.value)} placeholder="Any additional requirements..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Section 5 – Certification</CardTitle></CardHeader>
          <CardContent>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={contributionJustified}
                onChange={(e) => setContributionJustified(e.target.checked)}
                className="h-4 w-4 mt-1"
              />
              <span className="text-sm text-gray-700">
                The contribution expected from the new position justifies the additional cost incurred.
              </span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Raised By</CardTitle>
            <p className="text-sm text-gray-500">Details of the person who originally raised this MRF</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                placeholder="Name of person submitting this MRF"
                value={fillerName}
                onChange={(e) => setFillerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Designation *</Label>
              <Input
                value={fillerDesignation}
                onChange={(e) => setFillerDesignation(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href={`/dashboard/mrfs/${id}`}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={saving || !isValid()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
