"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

interface Country { id: string; name: string; locationType: string }
interface Division { id: string; name: string }
interface Branch { id: string; name: string; code: string }
interface Department { id: string; name: string; designations: Designation[] }
interface Designation { id: string; title: string; requiresPsychometric: boolean }

export default function NewMRFPage() {
  const router = useRouter();

  // Org data
  const [countries, setCountries] = useState<Country[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Location selection
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDesignation, setSelectedDesignation] = useState("");

  // Section 6 – Title
  const [title, setTitle] = useState("");

  // Section 2 – Vacancy Type
  const [vacancyType, setVacancyType] = useState<"REPLACEMENT" | "NEW_POSITION" | "">("");
  const [replacementFor, setReplacementFor] = useState("");
  const [replacementReason, setReplacementReason] = useState("");
  const [replacedEmployeeName, setReplacedEmployeeName] = useState("");
  const [replacedEmployeeCTC, setReplacedEmployeeCTC] = useState("");
  const [replacementNecessityReason, setReplacementNecessityReason] = useState("");
  const [isNewRole, setIsNewRole] = useState(false);
  const [isBusinessExpansion, setIsBusinessExpansion] = useState(false);
  const [newRoleJustification, setNewRoleJustification] = useState("");

  // Section 3 – Position Details
  const [isBudgeted, setIsBudgeted] = useState<boolean | null>(null);
  const [proposedGrade, setProposedGrade] = useState("");
  const [ctcRange, setCtcRange] = useState("");
  const [location, setLocation] = useState("");
  const [reportingTo, setReportingTo] = useState("");
  const [jobProfile, setJobProfile] = useState("");
  const [vacancyCount, setVacancyCount] = useState(1);

  // Section 4 – Specifications
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [minQualification, setMinQualification] = useState("");
  const [preferredQualification, setPreferredQualification] = useState("");
  const [workExperience, setWorkExperience] = useState("");
  const [industryBackground, setIndustryBackground] = useState("");
  const [otherSpecs, setOtherSpecs] = useState("");

  // Section 5 – Certification
  const [contributionJustified, setContributionJustified] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const countryObj = countries.find((c) => c.id === selectedCountry);
  const isIndia = countryObj?.locationType === "INDIA";
  const isOverseas = countryObj?.locationType === "OVERSEAS";
  const isCorporate = countryObj?.locationType === "CORPORATE";

  const designations = departments.find((d) => d.id === selectedDepartment)?.designations || [];

  useEffect(() => {
    fetch("/api/org/countries").then((r) => r.json()).then(setCountries);
    fetch("/api/org/departments").then((r) => r.json()).then(setDepartments);
  }, []);

  useEffect(() => {
    if (!selectedCountry) return;
    setSelectedDivision(""); setSelectedBranch("");
    setDivisions([]); setBranches([]);

    if (isIndia) {
      fetch(`/api/org/divisions?countryId=${selectedCountry}`)
        .then((r) => r.json()).then(setDivisions);
    } else if (isCorporate) {
      fetch(`/api/org/branches?countryId=${selectedCountry}`)
        .then((r) => r.json()).then(setBranches);
    }
  }, [selectedCountry, isIndia, isCorporate]);

  useEffect(() => {
    if (!selectedDivision) return;
    setSelectedBranch(""); setBranches([]);
    fetch(`/api/org/branches?divisionId=${selectedDivision}`)
      .then((r) => r.json()).then(setBranches);
  }, [selectedDivision]);

  const isValid = () => {
    if (!title || !selectedCountry || !selectedDepartment) return false;
    if (isIndia && (!selectedDivision || !selectedBranch)) return false;
    if (isCorporate && !selectedBranch) return false;
    if (!vacancyType) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isValid()) {
      setError("Please complete all required fields.");
      return;
    }
    setLoading(true);

    const payload = {
      title,
      countryId: selectedCountry,
      divisionId: selectedDivision || null,
      branchId: selectedBranch || null,
      // stateId intentionally omitted — branches are selected directly
      departmentId: selectedDepartment,
      designationId: selectedDesignation || null,
      vacancyCount,
      // Vacancy type
      vacancyType,
      replacementFor: vacancyType === "REPLACEMENT" ? replacementFor : null,
      replacementReason: vacancyType === "REPLACEMENT" ? replacementReason : null,
      replacedEmployeeName: vacancyType === "REPLACEMENT" ? replacedEmployeeName : null,
      replacedEmployeeCTC: vacancyType === "REPLACEMENT" ? replacedEmployeeCTC : null,
      replacementNecessityReason: vacancyType === "REPLACEMENT" ? replacementNecessityReason : null,
      isNewRole: vacancyType === "NEW_POSITION" ? isNewRole : false,
      isBusinessExpansion: vacancyType === "NEW_POSITION" ? isBusinessExpansion : false,
      newRoleJustification: vacancyType === "NEW_POSITION" ? newRoleJustification : null,
      // Position details
      isBudgeted,
      proposedGrade: proposedGrade || null,
      ctcRange: ctcRange || null,
      location: location || null,
      reportingTo: reportingTo || null,
      jobProfile: jobProfile || null,
      // Specifications
      minAge: minAge ? parseInt(minAge) : null,
      maxAge: maxAge ? parseInt(maxAge) : null,
      minQualification: minQualification || null,
      preferredQualification: preferredQualification || null,
      workExperience: workExperience || null,
      industryBackground: industryBackground || null,
      otherSpecs: otherSpecs || null,
      // Certification
      contributionJustified,
    };

    const res = await fetch("/api/mrfs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (res.ok) {
      const mrf = await res.json();
      router.push(`/dashboard/mrfs/${mrf.id}`);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create MRF.");
    }
  };

  const indiaCountries = countries.filter((c) => c.locationType === "INDIA");
  const overseasCountries = countries.filter((c) => c.locationType === "OVERSEAS");
  const corporateCountries = countries.filter((c) => c.locationType === "CORPORATE");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/mrfs">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">New Manpower Requisition Form</h2>
          <p className="text-sm text-gray-500">Fill in all sections to submit a new MRF</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Section 6 – Title / Reference */}
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

        {/* Section 1 – Location */}
        <Card>
          <CardHeader>
            <CardTitle>Section 1 – Location</CardTitle>
            <p className="text-sm text-gray-500">Select country first — options will filter accordingly</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Country / Location Type *</Label>
              <Select onValueChange={(v) => setSelectedCountry(v)}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {indiaCountries.length > 0 && (
                    <>
                      <SelectItem value="__india_group" disabled className="font-semibold text-gray-500">── India ──</SelectItem>
                      {indiaCountries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </>
                  )}
                  {overseasCountries.length > 0 && (
                    <>
                      <SelectItem value="__overseas_group" disabled className="font-semibold text-gray-500">── Overseas ──</SelectItem>
                      {overseasCountries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </>
                  )}
                  {corporateCountries.length > 0 && (
                    <>
                      <SelectItem value="__corp_group" disabled className="font-semibold text-gray-500">── Corporate ──</SelectItem>
                      {corporateCountries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {isOverseas && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                International postings do not require a specific branch/office.
              </div>
            )}

            {isIndia && (
              <>
                <div className="space-y-2">
                  <Label>Division *</Label>
                  <Select onValueChange={setSelectedDivision} disabled={!selectedCountry}>
                    <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
                    <SelectContent>
                      {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Branch / Office *</Label>
                  <Select onValueChange={setSelectedBranch} disabled={!selectedDivision}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.length === 0
                        ? <SelectItem value="__none" disabled>Select a division first</SelectItem>
                        : branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {isCorporate && (
              <div className="space-y-2">
                <Label>Office *</Label>
                <Select onValueChange={setSelectedBranch} disabled={!selectedCountry}>
                  <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2 – Vacancy Type */}
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

        {/* Section 3 – Position Details */}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department *</Label>
                <Select onValueChange={(v) => { setSelectedDepartment(v); setSelectedDesignation(""); }}>
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
                <Select onValueChange={setSelectedDesignation} disabled={!selectedDepartment}>
                  <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
                  <SelectContent>
                    {designations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Grade</Label>
                <Input value={proposedGrade} onChange={(e) => setProposedGrade(e.target.value)} placeholder="e.g. M3" />
              </div>
              <div className="space-y-2">
                <Label>CTC Range</Label>
                <Input value={ctcRange} onChange={(e) => setCtcRange(e.target.value)} placeholder="e.g. ₹5–7 LPA" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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

        {/* Section 4 – Specifications */}
        <Card>
          <CardHeader><CardTitle>Section 4 – Candidate Specifications</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Age</Label>
                <Input type="number" value={minAge} onChange={(e) => setMinAge(e.target.value)} placeholder="e.g. 22" />
              </div>
              <div className="space-y-2">
                <Label>Max Age</Label>
                <Input type="number" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} placeholder="e.g. 35" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Qualification</Label>
                <Input value={minQualification} onChange={(e) => setMinQualification(e.target.value)} placeholder="e.g. B.Sc. / Diploma" />
              </div>
              <div className="space-y-2">
                <Label>Preferred Qualification</Label>
                <Input value={preferredQualification} onChange={(e) => setPreferredQualification(e.target.value)} placeholder="e.g. M.Sc. / B.Tech" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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

        {/* Section 5 – Certification */}
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

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/dashboard/mrfs">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={loading || !isValid()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit MRF
          </Button>
        </div>
      </form>
    </div>
  );
}
