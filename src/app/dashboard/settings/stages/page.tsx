"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowUp, ArrowDown, Loader2, Check } from "lucide-react";

interface Stage {
  id: string;
  key: string;
  label: string;
  stepOrder: number;
  isActive: boolean;
}

export default function StagesSettingsPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const fetchStages = () => {
    fetch("/api/workflow-stages")
      .then((r) => r.json())
      .then((d) => { setStages(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => { fetchStages(); }, []);

  const patch = async (id: string, update: Partial<Stage>) => {
    setSaving(id);
    await fetch(`/api/workflow-stages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    setSaving(null);
    setSaved(id);
    setTimeout(() => setSaved(null), 1500);
    fetchStages();
  };

  const toggleActive = (stage: Stage) => patch(stage.id, { isActive: !stage.isActive });

  const move = async (index: number, direction: "up" | "down") => {
    const other = direction === "up" ? index - 1 : index + 1;
    if (other < 0 || other >= stages.length) return;

    const current = stages[index];
    const target = stages[other];

    // Swap step orders
    setSaving(current.id);
    await Promise.all([
      fetch(`/api/workflow-stages/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepOrder: target.stepOrder }),
      }),
      fetch(`/api/workflow-stages/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepOrder: current.stepOrder }),
      }),
    ]);
    setSaving(null);
    fetchStages();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workflow Stages</h2>
          <p className="text-sm text-gray-500">Enable/disable and reorder candidate pipeline stages</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline Stage Configuration</CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            Disabled stages are hidden from the stage selector. Stage order affects the candidate pipeline progression.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {stages.map((stage, i) => (
                <div
                  key={stage.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${!stage.isActive ? "bg-gray-50 opacity-60" : "hover:bg-gray-50"}`}
                >
                  {/* Step order badge */}
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0
                    ${stage.isActive ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"}`}>
                    {stage.stepOrder}
                  </div>

                  {/* Stage info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${stage.isActive ? "text-gray-900" : "text-gray-400 line-through"}`}>
                      {stage.label}
                    </p>
                    <p className="text-xs text-gray-400 font-mono">{stage.key}</p>
                  </div>

                  {/* Saved indicator */}
                  {saved === stage.id && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <Check className="h-3 w-3" /> Saved
                    </span>
                  )}

                  {/* Reorder buttons */}
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-gray-600"
                      disabled={i === 0 || !!saving}
                      onClick={() => move(i, "up")}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-gray-600"
                      disabled={i === stages.length - 1 || !!saving}
                      onClick={() => move(i, "down")}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Active toggle */}
                  <button
                    onClick={() => toggleActive(stage)}
                    disabled={!!saving}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 focus:outline-none
                      ${stage.isActive ? "bg-blue-600" : "bg-gray-300"}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
                        ${stage.isActive ? "translate-x-4" : "translate-x-0.5"}`}
                    />
                  </button>

                  {saving === stage.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400 shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400 text-center">
        Changes take effect immediately for new stage selections. Existing candidate stages are not affected.
      </p>
    </div>
  );
}
