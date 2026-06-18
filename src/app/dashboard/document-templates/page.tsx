"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Trash2, Download, Loader2, Upload } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  description: string | null;
  templateType: string;
  fileUrl: string;
  fileSize: number;
  createdAt: string;
  uploaderName: string;
}

const TEMPLATE_TYPES = [
  { key: "JOINING_FORM", label: "Joining Form" },
  { key: "DECLARATION_MSK", label: "Declaration of MSK" },
  { key: "TIC_COUNSEL", label: "TIC Counsel" },
  { key: "OTHER", label: "Other" },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(TEMPLATE_TYPES.map((t) => [t.key, t.label]));

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", templateType: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = () =>
    fetch("/api/document-templates")
      .then((r) => r.json())
      .then((d) => { setTemplates(Array.isArray(d) ? d : []); setLoading(false); });

  useEffect(() => { fetchTemplates(); }, []);

  const handleAdd = async () => {
    if (!selectedFile || !form.name || !form.templateType) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.append("file", selectedFile);
    fd.append("name", form.name);
    fd.append("description", form.description);
    fd.append("templateType", form.templateType);
    await fetch("/api/document-templates", { method: "POST", body: fd });
    setSubmitting(false);
    setShowAdd(false);
    setForm({ name: "", description: "", templateType: "" });
    setSelectedFile(null);
    fetchTemplates();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    setDeletingId(id);
    await fetch(`/api/document-templates/${id}`, { method: "DELETE" });
    setDeletingId(null);
    fetchTemplates();
  };

  const formatSize = (bytes: number) =>
    bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Document Templates</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage HR form templates — employees can download and submit completed versions.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Add Template
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <FileText className="mx-auto h-12 w-12 text-gray-200 mb-3" />
            <p className="font-medium">No templates yet</p>
            <p className="text-sm mt-1">Upload your first form template using the button above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500 uppercase">{TYPE_LABELS[t.templateType] || t.templateType}</p>
                    <CardTitle className="text-base mt-0.5 leading-tight">{t.name}</CardTitle>
                  </div>
                  <FileText className="h-8 w-8 text-gray-300 shrink-0 mt-0.5" />
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-xs text-gray-500">
                {t.description && <p className="text-gray-600 text-sm">{t.description}</p>}
                <p>Size: {formatSize(t.fileSize)}</p>
                <p>Uploaded by {t.uploaderName} · {formatDate(t.createdAt)}</p>
                <div className="flex gap-2 pt-2">
                  <a href={t.fileUrl} download target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      <Download className="h-3 w-3 mr-1" /> Download
                    </Button>
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-red-500"
                    disabled={deletingId === t.id}
                    onClick={() => handleDelete(t.id, t.name)}
                  >
                    {deletingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Template Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Document Template</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g. Employee Joining Form"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Template Type *</Label>
              <Select value={form.templateType} onValueChange={(v) => setForm({ ...form, templateType: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional description for employees"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>File (PDF) *</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3 w-3 mr-1" /> Choose File
                </Button>
                <span className="text-sm text-gray-500">{selectedFile ? selectedFile.name : "No file chosen"}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={handleAdd}
              disabled={!form.name || !form.templateType || !selectedFile || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Upload Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
