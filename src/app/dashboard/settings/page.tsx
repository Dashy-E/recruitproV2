import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { Settings, Database, Users, Globe, Building2, FileText, Shield } from "lucide-react";

async function count(table: string) {
  const [row] = await db(table).count<{ count: string }[]>("* as count");
  return Number(row.count);
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "MANAGE_SETTINGS") && !hasPermission(session, "MANAGE_ROLES")) redirect("/dashboard");

  const [userCount, candidateCount, mrfCount, documentCount, countryCount, branchCount, deptCount] = await Promise.all([
    count("RECRUIT_T_User"),
    count("RECRUIT_T_Candidate"),
    count("RECRUIT_T_MRF"),
    count("RECRUIT_T_Document"),
    count("RECRUIT_T_Country"),
    count("RECRUIT_T_Branch"),
    count("RECRUIT_T_Department"),
  ]);

  const recentUsers = await db("RECRUIT_T_User")
    .orderBy("createdAt", "desc")
    .limit(5)
    .select("name", "email", "role", "createdAt");

  const stats = [
    { label: "Total Users", value: userCount, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Candidates", value: candidateCount, icon: Users, color: "text-purple-600 bg-purple-50" },
    { label: "MRFs", value: mrfCount, icon: FileText, color: "text-green-600 bg-green-50" },
    { label: "Documents", value: documentCount, icon: FileText, color: "text-orange-600 bg-orange-50" },
    { label: "Countries", value: countryCount, icon: Globe, color: "text-red-600 bg-red-50" },
    { label: "Branches", value: branchCount, icon: Building2, color: "text-yellow-600 bg-yellow-50" },
    { label: "Departments", value: deptCount, icon: Building2, color: "text-gray-600 bg-gray-50" },
  ];

  const ROLE_COLORS: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-700",
    HR: "bg-blue-100 text-blue-700",
    BRANCH_MANAGER: "bg-green-100 text-green-700",
    DIVISIONAL_MANAGER: "bg-yellow-100 text-yellow-700",
    FUNCTIONAL_HEAD: "bg-orange-100 text-orange-700",
    COUNTRY_MANAGER: "bg-red-100 text-red-700",
    CANDIDATE: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-gray-700" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">Overview and system configuration</p>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4">
                <div className={`inline-flex items-center justify-center rounded-lg p-2 ${s.color} mb-2`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* System Configuration */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />System Info</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: "Database", value: "Oracle Database" },
              { label: "Auth Strategy", value: "JWT (NextAuth v4)" },
              { label: "Framework", value: "Next.js App Router" },
              { label: "Query Builder", value: "Knex.js + node-oracledb" },
              { label: "Environment", value: process.env.NODE_ENV || "development" },
              { label: "Approval Levels", value: "3 (Divisional → Functional → Country)" },
              { label: "Candidate Stages", value: "10 stages" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-right text-gray-700">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Role Permissions Summary */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Role Permissions</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { role: "ADMIN", perms: "Full access: users, MRFs, candidates, org, documents" },
              { role: "HR", perms: "Manage users, MRFs, candidates, documents, approvals" },
              { role: "BRANCH_MANAGER", perms: "Create MRFs, view candidates" },
              { role: "DIVISIONAL_MANAGER", perms: "Approve/reject divisional MRFs" },
              { role: "FUNCTIONAL_HEAD", perms: "Approve/reject functional MRFs" },
              { role: "COUNTRY_MANAGER", perms: "Approve/reject country-level MRFs" },
              { role: "CANDIDATE", perms: "View own application, upload documents (pre-shortlist)" },
            ].map(({ role: r, perms }) => (
              <div key={r} className="flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[r]}`}>
                  {r.replace(/_/g, " ")}
                </span>
                <span className="text-gray-600 text-xs">{perms}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Users */}
      <Card>
        <CardHeader><CardTitle>Recently Added Users</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentUsers.map((u: any) => (
              <div key={u.email} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                  {u.role.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-gray-400">{formatDate(u.createdAt)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Seed / Extend Org */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-yellow-800 text-base">Developer Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-yellow-700">
          <p>
            <strong>Seed database:</strong> POST to <code className="bg-yellow-100 px-1 rounded">/api/seed</code> to create initial data (admin, HR, org structure, sample MRF and candidate).
          </p>
          <p>
            <strong>Extend org structure:</strong> POST to <code className="bg-yellow-100 px-1 rounded">/api/seed/extend-org</code> to add missing SW/EC branches without overwriting existing data.
          </p>
          <p className="text-xs text-yellow-600">These endpoints are safe to call multiple times — they are idempotent.</p>
        </CardContent>
      </Card>
    </div>
  );
}
