import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CANDIDATE_STAGES, MRF_STATUSES, formatDate } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { BarChart3, Users, ClipboardList, CheckCircle } from "lucide-react";

async function count(table: string, where?: Record<string, unknown>) {
  const query = db(table);
  if (where) query.where(where);
  const [row] = await query.count<{ count: string }[]>("* as count");
  return Number(row.count);
}

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "VIEW_REPORTS")) redirect("/dashboard");

  const [
    totalMRFs, approvedMRFs, rejectedMRFs, pendingMRFs,
    totalCandidates, onboardedCandidates,
    candidatesByStage, mrfsByDepartment, mrfsByCountry,
    recentCandidatesRaw,
  ] = await Promise.all([
    count("RECRUIT_T_MRF"),
    count("RECRUIT_T_MRF", { status: "APPROVED" }),
    count("RECRUIT_T_MRF", { status: "REJECTED" }),
    db("RECRUIT_T_MRF")
      .whereIn("status", ["PENDING_DIVISIONAL", "PENDING_FUNCTIONAL", "PENDING_COUNTRY"])
      .count<{ count: string }[]>("* as count")
      .then((r) => Number(r[0].count)),
    count("RECRUIT_T_Candidate"),
    count("RECRUIT_T_Candidate", { currentStage: "ONBOARDED" }),
    db("RECRUIT_T_Candidate").groupBy("currentStage").select("currentStage").count({ count: "*" }),
    db("RECRUIT_T_MRF").groupBy("departmentId").select("departmentId").count({ count: "*" }),
    db("RECRUIT_T_MRF").groupBy("countryId").select("countryId").count({ count: "*" }),
    db("RECRUIT_T_Candidate").orderBy("createdAt", "desc").limit(10),
  ]);

  const departments = await db("RECRUIT_T_Department").select("id", "name");
  const countries = await db("RECRUIT_T_Country").select("id", "name");

  const deptMap = Object.fromEntries(departments.map((d: any) => [d.id, d.name]));
  const countryMap = Object.fromEntries(countries.map((c: any) => [c.id, c.name]));
  const stageMap = Object.fromEntries(candidatesByStage.map((s: any) => [s.currentStage, Number(s.count)]));

  const mrfIds = [...new Set(recentCandidatesRaw.map((c: any) => c.mrfId).filter(Boolean))];
  const mrfs = mrfIds.length ? await db("RECRUIT_T_MRF").whereIn("id", mrfIds) : [];
  const recentCandidates = recentCandidatesRaw.map((c: any) => ({
    ...c,
    mrf: c.mrfId ? mrfs.find((m: any) => m.id === c.mrfId) || null : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Recruitment Reports</h2>
        <p className="text-sm text-gray-500 mt-1">Complete visibility across all recruitment activity</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total MRFs", value: totalMRFs, icon: ClipboardList, color: "blue" },
          { label: "Approved MRFs", value: approvedMRFs, icon: CheckCircle, color: "green" },
          { label: "Total Candidates", value: totalCandidates, icon: Users, color: "purple" },
          { label: "Onboarded", value: onboardedCandidates, icon: CheckCircle, color: "teal" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg bg-${color}-100 p-3`}>
                  <Icon className={`h-5 w-5 text-${color}-600`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Candidate Pipeline */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" /> Candidate Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {CANDIDATE_STAGES.map((stage) => {
                const count = stageMap[stage.key] || 0;
                const pct = totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0;
                return (
                  <div key={stage.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{stage.label}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* MRFs by Department */}
        <Card>
          <CardHeader><CardTitle>MRFs by Department</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...mrfsByDepartment].sort((a: any, b: any) => Number(b.count) - Number(a.count)).map((row: any) => (
                <div key={row.departmentId} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{deptMap[row.departmentId] || "Unknown"}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-purple-500"
                        style={{ width: `${totalMRFs > 0 ? (Number(row.count) / totalMRFs) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-6 text-right">{Number(row.count)}</span>
                  </div>
                </div>
              ))}
              {mrfsByDepartment.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* MRFs by Country */}
        <Card>
          <CardHeader><CardTitle>MRFs by Country</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...mrfsByCountry].sort((a: any, b: any) => Number(b.count) - Number(a.count)).map((row: any) => (
                <div key={row.countryId} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{countryMap[row.countryId] || "Unknown"}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-green-500"
                        style={{ width: `${totalMRFs > 0 ? (Number(row.count) / totalMRFs) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-6 text-right">{Number(row.count)}</span>
                  </div>
                </div>
              ))}
              {mrfsByCountry.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MRF Status Breakdown */}
      <Card>
        <CardHeader><CardTitle>MRF Status Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(MRF_STATUSES).map(([key, val]) => {
              const countVal =
                key === "APPROVED" ? approvedMRFs :
                key === "REJECTED" ? rejectedMRFs :
                key === "DRAFT" ? totalMRFs - approvedMRFs - rejectedMRFs - pendingMRFs :
                key === "PENDING_DIVISIONAL" || key === "PENDING_FUNCTIONAL" || key === "PENDING_COUNTRY"
                  ? pendingMRFs / 3 : 0;
              return (
                <div key={key} className={`flex items-center gap-3 rounded-lg px-4 py-3 ${val.color}`}>
                  <span className="text-sm font-medium">{val.label}</span>
                  <span className="text-xl font-bold">{Math.round(countVal)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Candidates */}
      <Card>
        <CardHeader><CardTitle>Recent Candidates</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>MRF / Position</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentCandidates.map((c: any) => {
                const stage = CANDIDATE_STAGES.find((s) => s.key === c.currentStage);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
                    <TableCell className="text-sm text-gray-500">{c.email}</TableCell>
                    <TableCell className="text-sm">{c.mrf?.title || "—"}</TableCell>
                    <TableCell><Badge variant="default">{stage?.label || c.currentStage}</Badge></TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(c.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
              {recentCandidates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-gray-400">No candidates yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
