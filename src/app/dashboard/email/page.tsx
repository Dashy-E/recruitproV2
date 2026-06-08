"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Plus, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface EmailRecord {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  sentAt: string;
  candidateId: string | null;
  candidate: { firstName: string; lastName: string } | null;
}

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function EmailPage() {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EmailRecord | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [form, setForm] = useState({ toEmail: "", subject: "", body: "", candidateId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchEmails = () => {
    fetch("/api/emails")
      .then((r) => r.json())
      .then((d) => { setEmails(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => {
    fetchEmails();
    fetch("/api/candidates")
      .then((r) => r.json())
      .then((d) => setCandidates(Array.isArray(d) ? d : []));
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
        ...form,
        candidateId: form.candidateId && form.candidateId !== "__none" ? form.candidateId : null,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setShowCompose(false);
      setForm({ toEmail: "", subject: "", body: "", candidateId: "" });
      fetchEmails();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to send email.");
    }
  };

  const openCompose = () => {
    setForm({ toEmail: "", subject: "", body: "", candidateId: "" });
    setError("");
    setShowCompose(true);
  };

  const selectCandidate = (id: string) => {
    const c = candidates.find((c) => c.id === id);
    setForm((prev) => ({
      ...prev,
      candidateId: id,
      toEmail: c ? c.email : prev.toEmail,
    }));
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
                      {email.candidate && (
                        <p className="text-xs text-blue-500">{email.candidate.firstName} {email.candidate.lastName}</p>
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
                    {selected.candidate && (
                      <p className="text-xs text-blue-600">Linked candidate: {selected.candidate.firstName} {selected.candidate.lastName}</p>
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
            <div className="space-y-2">
              <Label>Link to Candidate (optional)</Label>
              <Select value={form.candidateId} onValueChange={selectCandidate}>
                <SelectTrigger><SelectValue placeholder="Select candidate (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
