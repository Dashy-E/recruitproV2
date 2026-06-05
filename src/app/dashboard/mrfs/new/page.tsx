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
interface Division { id: string; name: string; states: State[] }
interface State { id: string; name: string; branches: Branch[] }
interface Branch { id: string; name: string; code: string }
interface Department { id: string; name: string; designations: Designation[] }
interface Designation { id: string; title: string; requiresPsychometric: boolean }

export default function NewMRFPage() {
  const router = useRouter();

  const [countries, setCountries] = useState<Country[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDesignation, setSelectedDesignation] = useState("");

  const [title, setTitle] = useState("");
  const [vacancyCount, setVacancyCount] = useState(1);
  const [justification, setJustification] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const countryType = countries.find((c) => c.id === selectedCountry)?.locationType;
  const isIndia = countryType === "INDIA";
  const isOverseas = countryType === "OVERSEAS";
  const isCorporate = countryType === "CORPORATE";

  const designations = departments.find((d) => d.id === selectedDepartment)?.designations || [];

  useEffect(() => {
    fetch("/api/org/countries").then((r) => r.json()).then(setCountries);
    fetch("/api/org/departments").then((r) => r.json()).then(setDepartments);
  }, []);

  useEffect(() => {
    if (!selectedCountry) return;
    setSelectedDivision(""); setSelectedState(""); setSelectedBranch("");
    setDivisions([]); setStates([]); setBranches([]);

    if (isIndia) {
      fetch(`/api/org/divisions?countryId=${selectedCountry}`)
        .then((r) => r.json()).then(setDivisions);
    } else {
      fetch(`/api/org/branches?countryId=${selectedCountry}`)
        .then((r) => r.json()).then(setBranches);
    }
  }, [selectedCountry, isIndia]);

  useEffect(() => {
    if (!selectedDivision) return;
    setSelectedState(""); setSelectedBranch(""); setStates([]); setBranches([]);
    const div = divisions.find((d) => d.id === selectedDivision);
    if (div) setStates(div.states);
  }, [selectedDivision, divisions]);

  useEffect(() => {
    if (!selectedState) return;
    setSelectedBranch(""); setBranches([]);
    const state = states.find((s) => s.id === selectedState);
    if (state) setBranches(state.branches);
  }, [selectedState, states]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selectedBranch || !selectedDepartment) {
      setError("Please complete all required fields.");
      return;
    }
    setLoading(true);

    const res = await fetch("/api/mrfs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        countryId: selectedCountry,
        divisionId: selectedDivision || null,
        branchId: selectedBranch,
        departmentId: selectedDepartment,
        designationId: selectedDesignation || null,
        vacancyCount,
        justification,
      }),
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/mrfs">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">New Manpower Requisition Form</h2>
          <p className="text-sm text-gray-500">Fill in the details to submit a new MRF</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Position Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">MRF Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Engineer – Gandhidham Operations"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
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
                <Label>Designation</Label>
                <Select onValueChange={setSelectedDesignation} disabled={!selectedDepartment}>
                  <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
                  <SelectContent>
                    {designations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title} {d.requiresPsychometric ? "• Psych" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vacancyCount">Number of Vacancies *</Label>
              <Input
                id="vacancyCount"
                type="number"
                min={1}
                value={vacancyCount}
                onChange={(e) => setVacancyCount(parseInt(e.target.value))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">Justification / Reason for Hiring</Label>
              <Textarea
                id="justification"
                placeholder="Briefly explain the business need for this position..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
            <p className="text-sm text-gray-500">Select country first — options will filter accordingly</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Country Selection */}
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

            {/* India: Division → State → Branch */}
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
                  <Label>State *</Label>
                  <Select onValueChange={setSelectedState} disabled={!selectedDivision}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>
                      {states.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Branch *</Label>
                  <Select onValueChange={setSelectedBranch} disabled={!selectedState}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Overseas / Corporate: direct Branch */}
            {(isOverseas || isCorporate) && (
              <div className="space-y-2">
                <Label>Branch / Office *</Label>
                <Select onValueChange={setSelectedBranch} disabled={!selectedCountry}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/dashboard/mrfs">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit MRF
          </Button>
        </div>
      </form>
    </div>
  );
}
