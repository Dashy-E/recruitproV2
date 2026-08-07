"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Plus, Loader2, ClipboardList, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface MRFOption {
  id: string;
  referenceNumber: string;
  mrfNumber: string | null;
  title: string;
  status: string;
}

interface EmailRecord {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  sentAt: string;
  mrfId: string | null;
  mrf: { id: string; referenceNumber: string; mrfNumber: string | null; title: string } | null;
}

export default function EmailPage() {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EmailRecord | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [mrfs, setMrfs] = useState<MRFOption[]>([]);
  const [mrfSearch, setMrfSearch] = useState("");
  const [form, setForm] = useState({ toEmail: "", subject: "", body: "", mrfId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchEmails = () => {
    fetch("/api/emails")
      .then((r) => r.json())
      .then((d) => { setEmails(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => {
    fetchEmails();
    // Fetch pending-approval MRFs only
    fetch("/api/mrfs")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setMrfs(d.filter((m: MRFOption) =>
            ["PENDING_DIVISIONAL", "PENDING_COUNTRY_SUPERVISOR", "PENDING_FUNCTIONAL"].includes(m.status)
          ));
        }
      });
  }, []);

  const handleCompose = async () => {
    setError("");
    if (!form.toEmail || !form.subject || !form.body) {
      setError("To, Subject, and Body are required.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toEmail: form.toEmail,
        subject: form.subject,
        body: form.body,
        mrfId: form.mrfId && form.mrfId !== "__none" ? form.mrfId : null,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setShowCompose(false);
      toast({ variant: "success", title: "Email sent", description: `Sent to ${form.toEmail}.` });
      setForm({ toEmail: "", subject: "", body: "", mrfId: "" });
      setMrfSearch("");
      fetchEmails();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to send email.");
    }
  };

  const openCompose = () => {
    setForm({ toEmail: "", subject: "", body: "", mrfId: "" });
    setMrfSearch("");
    setError("");
    setShowCompose(true);
  };

  const selectMrf = (mrf: MRFOption) => {
    setForm((prev) => ({
      ...prev,
      mrfId: mrf.id,
      subject: prev.subject || `Re: MRF ${mrf.mrfNumber || mrf.referenceNumber} — ${mrf.title}`,
    }));
    setMrfSearch(`${mrf.mrfNumber || mrf.referenceNumber} — ${mrf.title}`);
  };

  const filteredMrfs = mrfSearch.length > 0
    ? mrfs.filter((m) =>
        (m.mrfNumber || "").toLowerCase().includes(mrfSearch.toLowerCase()) ||
        m.referenceNumber.toLowerCase().includes(mrfSearch.toLowerCase()) ||
        m.title.toLowerCase().includes(mrfSearch.toLowerCase())
      )
    : mrfs;

  const [showMrfDropdown, setShowMrfDropdown] = useState(false);

  const STATUS_LABELS: Record<string, string> = {
    PENDING_DIVISIONAL: "Pending Divisional/Country",
    PENDING_COUNTRY_SUPERVISOR: "Pending Country Supervisor",
    PENDING_FUNCTIONAL: "Pending Functional",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Email</h2>
          <p className="text-sm text-gray-500 mt-1">Sent emails log</p>
        </div>
        <Button onClick={openCompose}>
          <Plus className="h-4 w-4 mr-1" /> Compose
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Email List */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader><CardTitle className="text-sm font-semibold text-gray-600">Sent ({emails.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
              ) : emails.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <Mail className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                  <p className="text-sm">No emails sent yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {emails.map((email) => (
                    <li
                      key={email.id}
                      onClick={() => setSelected(email)}
                      className={`cursor-pointer px-4 py-3 hover:bg-gray-50 transition-colors ${selected?.id === email.id ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{email.subject}</p>
                      <p className="text-xs text-gray-500 truncate">To: {email.toEmail}</p>
                      {email.mrf && (
                        <p className="text-xs text-blue-500 truncate">MRF: {email.mrf.mrfNumber || email.mrf.referenceNumber}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(email.sentAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Email Detail */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            {selected ? (
              <>
                <CardHeader>
                  <div className="space-y-1">
                    <CardTitle>{selected.subject}</CardTitle>
                    <p className="text-sm text-gray-500">To: {selected.toEmail}</p>
                    <p className="text-xs text-gray-400">{formatDate(selected.sentAt)}</p>
                    {selected.mrf && (
                      <div className="flex items-center gap-2 mt-1">
                        <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
                        <Link
                          href={`/dashboard/mrfs/${selected.mrf.id}`}
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          {selected.mrf.mrfNumber || selected.mrf.referenceNumber} — {selected.mrf.title}
                        </Link>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{selected.body}</pre>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center h-full py-20">
                <div className="text-center text-gray-400">
                  <Mail className="mx-auto h-12 w-12 text-gray-200 mb-3" />
                  <p>Select an email to view</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Compose Email</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {/* MRF Selector */}
            <div className="space-y-2">
              <Label>Link MRF (optional — pending approval only)</Label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    className="pl-8 text-sm"
                    placeholder="Search by MRF number or title…"
                    value={mrfSearch}
                    autoComplete="off"
                    onChange={(e) => {
                      setMrfSearch(e.target.value);
                      if (!e.target.value) setForm((p) => ({ ...p, mrfId: "" }));
                      setShowMrfDropdown(true);
                    }}
                    onFocus={() => setShowMrfDropdown(true)}
                    onBlur={() => setTimeout(() => setShowMrfDropdown(false), 150)}
                  />
                </div>
                {showMrfDropdown && filteredMrfs.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50"
                      onMouseDown={() => { setForm((p) => ({ ...p, mrfId: "" })); setMrfSearch(""); setShowMrfDropdown(false); }}
                    >
                      — No MRF —
                    </button>
                    {filteredMrfs.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors ${form.mrfId === m.id ? "bg-blue-50" : ""}`}
                        onMouseDown={() => { selectMrf(m); setShowMrfDropdown(false); }}
                      >
                        <p className="text-sm font-medium text-gray-900">{m.mrfNumber || m.referenceNumber} — {m.title}</p>
                        <p className="text-xs text-yellow-600">{STATUS_LABELS[m.status] || m.status}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {form.mrfId && (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <ClipboardList className="h-3 w-3" />
                  MRF linked — receiver can open MRF page directly from email.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>To *</Label>
              <Input
                type="email"
                value={form.toEmail}
                onChange={(e) => setForm({ ...form, toEmail: e.target.value })}
                placeholder="recipient@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Email subject"
              />
            </div>
            <div className="space-y-2">
              <Label>Body *</Label>
              <Textarea
                rows={6}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Write your email here..."
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompose(false)}>Cancel</Button>
            <Button onClick={handleCompose} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
