"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Globe, Building2, ChevronDown, ChevronRight, Loader2, Trash2, Pencil } from "lucide-react";

interface Country {
  id: string; name: string; code: string; locationType: string; isActive: boolean;
  divisions: Division[];
  branches: Branch[];
}
interface Division { id: string; name: string; states: State[]; branches: Branch[] }
interface State { id: string; name: string; branches: Branch[] }
interface Branch { id: string; name: string; code: string }

const TYPE_COLORS: Record<string, string> = {
  INDIA: "bg-orange-100 text-orange-700",
  OVERSEAS: "bg-blue-100 text-blue-700",
  CORPORATE: "bg-purple-100 text-purple-700",
};

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Country dialogs
  const [showAdd, setShowAdd] = useState(false);
  const [editCountry, setEditCountry] = useState<Country | null>(null);
  const [countryForm, setCountryForm] = useState({ name: "", code: "", locationType: "OVERSEAS" });
  const [deletingCountryId, setDeletingCountryId] = useState<string | null>(null);

  // Branch dialogs
  const [showAddBranch, setShowAddBranch] = useState<{ countryId: string; countryName: string } | null>(null);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState({ name: "", code: "" });
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const fetchCountries = () =>
    fetch("/api/org/countries").then((r) => r.json()).then((d) => { setCountries(Array.isArray(d) ? d : []); setLoading(false); });

  useEffect(() => { fetchCountries(); }, []);

  // ── Country CRUD ──────────────────────────────────────────────

  const handleAddCountry = async () => {
    setSubmitting(true);
    await fetch("/api/org/countries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(countryForm),
    });
    setSubmitting(false); setShowAdd(false);
    setCountryForm({ name: "", code: "", locationType: "OVERSEAS" });
    fetchCountries();
  };

  const handleEditCountry = async () => {
    if (!editCountry) return;
    setSubmitting(true);
    await fetch(`/api/org/countries/${editCountry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(countryForm),
    });
    setSubmitting(false); setEditCountry(null);
    fetchCountries();
  };

  const handleDeleteCountry = async (country: Country) => {
    if (!confirm(`Delete country "${country.name}"? This cannot be undone.`)) return;
    setDeletingCountryId(country.id);
    const res = await fetch(`/api/org/countries/${country.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeletingCountryId(null);
    if (!res.ok) { alert(data.error || "Failed to delete country."); return; }
    fetchCountries();
  };

  // ── Branch CRUD ───────────────────────────────────────────────

  const handleAddBranch = async () => {
    if (!showAddBranch) return;
    setSubmitting(true);
    await fetch("/api/org/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...branchForm, countryId: showAddBranch.countryId }),
    });
    setSubmitting(false); setShowAddBranch(null);
    setBranchForm({ name: "", code: "" });
    fetchCountries();
  };

  const handleEditBranch = async () => {
    if (!editBranch) return;
    setSubmitting(true);
    await fetch(`/api/org/branches/${editBranch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branchForm),
    });
    setSubmitting(false); setEditBranch(null);
    fetchCountries();
  };

  const handleDeleteBranch = async (branch: Branch) => {
    if (!confirm(`Delete branch "${branch.name}"? This cannot be undone.`)) return;
    setDeletingBranchId(branch.id);
    const res = await fetch(`/api/org/branches/${branch.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeletingBranchId(null);
    if (!res.ok) { alert(data.error || "Failed to delete branch."); return; }
    fetchCountries();
  };

  const openEditCountry = (country: Country) => {
    setCountryForm({ name: country.name, code: country.code, locationType: country.locationType });
    setEditCountry(country);
  };

  const openEditBranch = (branch: Branch) => {
    setBranchForm({ name: branch.name, code: branch.code });
    setEditBranch(branch);
  };

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Branch chip ───────────────────────────────────────────────

  const BranchChip = ({ b }: { b: Branch }) => (
    <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 group">
      <Building2 className="h-3 w-3 text-gray-400 shrink-0" />
      <span className="text-xs text-gray-700">{b.name}</span>
      <span className="text-xs text-gray-400 font-mono">({b.code})</span>
      <button
        onClick={(e) => { e.stopPropagation(); openEditBranch(b); }}
        className="ml-1 text-gray-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
        title="Edit branch"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleDeleteBranch(b); }}
        disabled={deletingBranchId === b.id}
        className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
        title="Delete branch"
      >
        {deletingBranchId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </button>
    </div>
  );

  // ── Country card ──────────────────────────────────────────────

  const renderCountry = (country: Country) => {
    const isOpen = expanded[country.id];
    const allBranches = [
      ...country.branches,
      ...country.divisions.flatMap((d) => [...(d.branches || []), ...d.states.flatMap((s) => s.branches)]),
    ];
    return (
      <Card key={country.id} className="overflow-hidden">
        <div
          className="w-full text-left px-6 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer select-none"
          onClick={() => toggle(country.id)}
        >
          <Globe className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{country.name}</span>
              <span className="text-xs text-gray-400 font-mono">({country.code})</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[country.locationType] || "bg-gray-100 text-gray-600"}`}>
                {country.locationType}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {country.divisions.length > 0 ? `${country.divisions.length} division(s) · ` : ""}
              {allBranches.length} branch(es)
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditCountry(country); }}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleDeleteCountry(country); }}
              disabled={deletingCountryId === country.id}
              className="text-gray-400 hover:text-red-500"
            >
              {deletingCountryId === country.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setShowAddBranch({ countryId: country.id, countryName: country.name }); }}>
              <Plus className="h-3 w-3" /> Branch
            </Button>
            {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
          </div>
        </div>

        {isOpen && (
          <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
            {country.divisions.map((div) => (
              <div key={div.id} className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{div.name}</p>
                {/* Direct division branches (e.g. Corporate) */}
                {(div.branches || []).length > 0 && (
                  <div className="ml-4 flex flex-wrap gap-2 mb-3">
                    {(div.branches || []).map((b) => <BranchChip key={b.id} b={b} />)}
                  </div>
                )}
                {div.states.map((state) => (
                  <div key={state.id} className="mb-3 ml-4">
                    <p className="text-xs font-medium text-gray-600 mb-1">📍 {state.name}</p>
                    <div className="ml-4 flex flex-wrap gap-2">
                      {state.branches.map((b) => <BranchChip key={b.id} b={b} />)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {country.branches.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {country.branches.map((b) => <BranchChip key={b.id} b={b} />)}
              </div>
            )}
            {allBranches.length === 0 && <p className="text-sm text-gray-400">No branches yet.</p>}
          </div>
        )}
      </Card>
    );
  };

  const indiaCountries = countries.filter((c) => c.locationType === "INDIA");
  const overseasCountries = countries.filter((c) => c.locationType === "OVERSEAS");
  const corporateCountries = countries.filter((c) => c.locationType === "CORPORATE");

  const CountryFormFields = () => (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Country Name *</Label>
          <Input placeholder="e.g. Vietnam" value={countryForm.name} onChange={(e) => setCountryForm({ ...countryForm, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Country Code *</Label>
          <Input placeholder="e.g. VN" value={countryForm.code} onChange={(e) => setCountryForm({ ...countryForm, code: e.target.value.toUpperCase() })} maxLength={5} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Location Type *</Label>
        <Select value={countryForm.locationType} onValueChange={(v) => setCountryForm({ ...countryForm, locationType: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="INDIA">India</SelectItem>
            <SelectItem value="OVERSEAS">Overseas</SelectItem>
            <SelectItem value="CORPORATE">Corporate</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Countries & Branches</h2>
          <p className="text-sm text-gray-500 mt-1">{countries.length} countries configured</p>
        </div>
        <Button onClick={() => { setCountryForm({ name: "", code: "", locationType: "OVERSEAS" }); setShowAdd(true); }}>
          <Plus className="h-4 w-4" /> Add Country
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>
      ) : (
        <div className="space-y-6">
          {indiaCountries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">India</h3>
              <div className="space-y-2">{indiaCountries.map(renderCountry)}</div>
            </div>
          )}
          {overseasCountries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Overseas</h3>
              <div className="space-y-2">{overseasCountries.map(renderCountry)}</div>
            </div>
          )}
          {corporateCountries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Corporate</h3>
              <div className="space-y-2">{corporateCountries.map(renderCountry)}</div>
            </div>
          )}
        </div>
      )}

      {/* Add Country Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Country / Location</DialogTitle></DialogHeader>
          <CountryFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddCountry} disabled={!countryForm.name || !countryForm.code || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Add Country
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Country Dialog */}
      <Dialog open={!!editCountry} onOpenChange={(o) => !o && setEditCountry(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Country</DialogTitle></DialogHeader>
          <CountryFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCountry(null)}>Cancel</Button>
            <Button onClick={handleEditCountry} disabled={!countryForm.name || !countryForm.code || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Branch Dialog */}
      <Dialog open={!!showAddBranch} onOpenChange={() => setShowAddBranch(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Branch to {showAddBranch?.countryName}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Branch Name *</Label>
                <Input placeholder="e.g. Ho Chi Minh City" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Branch Code *</Label>
                <Input placeholder="e.g. HCM" value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })} maxLength={10} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBranch(null)}>Cancel</Button>
            <Button onClick={handleAddBranch} disabled={!branchForm.name || !branchForm.code || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Add Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Dialog */}
      <Dialog open={!!editBranch} onOpenChange={(o) => !o && setEditBranch(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Branch</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Branch Name *</Label>
                <Input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Branch Code *</Label>
                <Input value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })} maxLength={10} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBranch(null)}>Cancel</Button>
            <Button onClick={handleEditBranch} disabled={!branchForm.name || !branchForm.code || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
