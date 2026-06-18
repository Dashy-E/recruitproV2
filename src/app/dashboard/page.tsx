import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Users, CheckCircle, Clock, TrendingUp, FileText } from "lucide-react";
import { CANDIDATE_STAGES } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role || "";
  const userId = (session?.user as { id?: string })?.id || "";

  const [mrfCount, candidateCount, approvedMRFs, pendingMRFs] = await Promise.all([
    prisma.mRF.count(),
    prisma.candidate.count(),
    prisma.mRF.count({ where: { status: "APPROVED" } }),
    prisma.mRF.count({ where: { status: { in: ["PENDING_DIVISIONAL", "PENDING_FUNCTIONAL", "PENDING_COUNTRY"] } } }),
  ]);

  const recentMRFs = await prisma.mRF.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { branch: true, department: true, createdBy: true },
  });

  const stageStats = await prisma.candidate.groupBy({
    by: ["currentStage"],
    _count: { id: true },
  });

  const stageMap = Object.fromEntries(stageStats.map((s) => [s.currentStage, s._count.id]));

  const isCandidateUser = role === "CANDIDATE";
  const isEmployeeUser = role === "EMPLOYEE";

  if (isEmployeeUser) {
    redirect("/dashboard/employee-portal");
  }

  if (isCandidateUser) {
    const candidate = await prisma.candidate.findFirst({
      where: { userId },
      include: {
        mrf: { include: { department: true, branch: true } },
        stageHistory: { orderBy: { changedAt: "desc" } },
        employee: true,
      },
    });

    const candidateNotifications = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM Notification WHERE userId = ? ORDER BY createdAt DESC LIMIT 10`, userId
    );

    // If candidate has an employee record, show Employee Portal view
    if (candidate?.employee) {
      const emp = candidate.employee;
      return (
        <div className="space-y-6">
          <div className="rounded-lg bg-green-600 p-6 text-white">
            <h2 className="text-2xl font-bold">Welcome back, {session?.user?.name}!</h2>
            <p className="mt-1 text-green-100">You are now an employee of the organisation.</p>
          </div>
          <Card>
            <CardHeader><CardTitle>Employee Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee Code</span>
                <span className="font-mono font-semibold">{emp.employeeCode}</span>
              </div>
              {emp.department && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Department</span>
                  <span>{emp.department}</span>
                </div>
              )}
              {emp.designation && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Designation</span>
                  <span>{emp.designation}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Joining Date</span>
                <span>{new Date(emp.joiningDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="rounded-lg bg-blue-600 p-6 text-white">
          <h2 className="text-2xl font-bold">Welcome back, {session?.user?.name}!</h2>
          <p className="mt-1 text-blue-100">Track your recruitment progress below.</p>
        </div>

        {/* Notifications */}
        {candidateNotifications.length > 0 && (
          <div className="space-y-2">
            {candidateNotifications.map((n: any) => (
              <div key={n.id} className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${
                n.isRead ? "border-gray-200 bg-gray-50" : "border-yellow-300 bg-yellow-50"
              }`}>
                <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${n.isRead ? "bg-gray-300" : "bg-yellow-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${n.isRead ? "text-gray-600" : "text-gray-900"}`}>{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{new Date(n.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
              </div>
            ))}
          </div>
        )}

        {candidate ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Your Application</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <p className="text-sm text-gray-500">Position</p>
                  <p className="font-medium">{candidate.mrf?.title || "—"}</p>
                  <p className="text-sm text-gray-500 mt-1">{candidate.mrf?.department?.name}{candidate.mrf?.branch ? ` · ${candidate.mrf.branch.name}` : ""}</p>
                </div>
                <div className="space-y-3">
                  {CANDIDATE_STAGES.map((stage) => {
                    const currentIdx = CANDIDATE_STAGES.findIndex((s) => s.key === candidate.currentStage);
                    const stageIdx = CANDIDATE_STAGES.findIndex((s) => s.key === stage.key);
                    const status = stageIdx < currentIdx ? "completed" : stageIdx === currentIdx ? "current" : "pending";

                    return (
                      <div key={stage.key} className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium
                          ${status === "completed" ? "bg-green-100 text-green-700" :
                            status === "current" ? "bg-blue-600 text-white" :
                            "bg-gray-100 text-gray-400"}`}>
                          {status === "completed" ? "✓" : stage.step}
                        </div>
                        <span className={`text-sm ${status === "current" ? "font-semibold text-blue-600" : status === "completed" ? "text-gray-700" : "text-gray-400"}`}>
                          {stage.label}
                        </span>
                        {status === "current" && (
                          <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Current Stage</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No active application found. Please contact HR.
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const isUniversalManager = role === "COUNTRY_MANAGER";

  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isUniversalManager ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-100 p-3">
                <ClipboardList className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total MRFs</p>
                <p className="text-2xl font-bold text-gray-900">{mrfCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-green-100 p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Approved MRFs</p>
                <p className="text-2xl font-bold text-gray-900">{approvedMRFs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-yellow-100 p-3">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Approvals</p>
                <p className="text-2xl font-bold text-gray-900">{pendingMRFs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {!isUniversalManager && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-purple-100 p-3">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Candidates</p>
                  <p className="text-2xl font-bold text-gray-900">{candidateCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {!isUniversalManager && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Candidates by Stage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {CANDIDATE_STAGES.map((stage) => {
                  const count = stageMap[stage.key] || 0;
                  const pct = candidateCount > 0 ? Math.round((count / candidateCount) * 100) : 0;
                  return (
                    <div key={stage.key} className="flex items-center gap-3">
                      <span className="w-44 text-sm text-gray-600 truncate">{stage.label}</span>
                      <div className="flex-1 rounded-full bg-gray-100 h-2">
                        <div className="rounded-full bg-blue-500 h-2 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-sm font-medium text-gray-700">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={isUniversalManager ? "lg:col-span-2" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Recent MRFs
              </CardTitle>
              <Link href="/dashboard/mrfs" className="text-sm text-blue-600 hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentMRFs.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No MRFs created yet.</p>
              )}
              {recentMRFs.map((mrf) => (
                <Link key={mrf.id} href={`/dashboard/mrfs/${mrf.id}`}>
                  <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{mrf.title}</p>
                      <p className="text-xs text-gray-500">{mrf.mrfNumber} · {mrf.department.name}{mrf.branch ? ` · ${mrf.branch.name}` : ""}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium
                      ${mrf.status === "APPROVED" ? "bg-green-100 text-green-700" :
                        mrf.status === "REJECTED" ? "bg-red-100 text-red-700" :
                        mrf.status === "DRAFT" ? "bg-gray-100 text-gray-600" :
                        "bg-yellow-100 text-yellow-700"}`}>
                      {mrf.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
