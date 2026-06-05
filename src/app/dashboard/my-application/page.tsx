import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CANDIDATE_STAGES, formatDate } from "@/lib/utils";
import { CheckCircle, Clock, ChevronRight } from "lucide-react";

export default async function MyApplicationPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (role !== "CANDIDATE") redirect("/dashboard");

  const candidate = await prisma.candidate.findFirst({
    where: { userId },
    include: {
      mrf: {
        include: {
          country: true,
          branch: true,
          department: true,
          designation: true,
        },
      },
      stageHistory: { orderBy: { changedAt: "asc" } },
      documents: true,
      offerDetail: true,
    },
  });

  if (!candidate) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <Clock className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No Active Application</h3>
            <p className="text-gray-500 mt-2">
              You have not been linked to any recruitment process yet. Please contact HR.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentIdx = CANDIDATE_STAGES.findIndex((s) => s.key === candidate.currentStage);
  const requiresPsychometric = candidate.mrf?.designation?.requiresPsychometric ?? true;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
        <h2 className="text-2xl font-bold">Hello, {candidate.firstName}!</h2>
        <p className="mt-1 text-blue-100">Here is your real-time recruitment progress.</p>
      </div>

      {/* Position Info */}
      {candidate.mrf && (
        <Card>
          <CardHeader><CardTitle>Your Position</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Position</span>
              <span className="font-semibold text-gray-900">{candidate.mrf.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Department</span>
              <span>{candidate.mrf.department.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Location</span>
              <span>{candidate.mrf.branch.name}, {candidate.mrf.country.name}</span>
            </div>
            {candidate.mrf.designation && (
              <div className="flex justify-between">
                <span className="text-gray-500">Designation</span>
                <span>{candidate.mrf.designation.title}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Current Stage</span>
              <Badge variant="default">
                {CANDIDATE_STAGES.find((s) => s.key === candidate.currentStage)?.label || candidate.currentStage}
              </Badge>
            </div>
            {candidate.aiScore != null && (
              <div className="flex justify-between">
                <span className="text-gray-500">AI Screening Score</span>
                <span className={`font-bold ${candidate.aiScore >= 70 ? "text-green-600" : "text-orange-600"}`}>
                  {candidate.aiScore.toFixed(1)}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recruitment Pipeline */}
      <Card>
        <CardHeader><CardTitle>Recruitment Progress</CardTitle></CardHeader>
        <CardContent>
          <div className="relative">
            {CANDIDATE_STAGES.map((stage, idx) => {
              const isSkipped = stage.key === "PSYCHOMETRIC_TEST" && !requiresPsychometric;
              const status = idx < currentIdx ? "done" : idx === currentIdx ? "current" : "pending";
              const historyEntry = candidate.stageHistory.find((h) => h.toStage === stage.key);

              if (isSkipped) {
                return (
                  <div key={stage.key} className="flex items-center gap-4 py-3 opacity-40">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-sm">—</div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-400 line-through">{stage.label}</p>
                      <p className="text-xs text-gray-400">Not required for your designation</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={stage.key} className="flex items-start gap-4 py-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold
                    ${status === "done" ? "bg-green-500 text-white" :
                      status === "current" ? "bg-blue-600 text-white" :
                      "bg-gray-100 text-gray-400"}`}>
                    {status === "done" ? <CheckCircle className="h-5 w-5" /> :
                     status === "current" ? <Clock className="h-5 w-5" /> :
                     stage.step}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium
                        ${status === "done" ? "text-gray-700" :
                          status === "current" ? "text-blue-700" :
                          "text-gray-400"}`}>
                        {stage.label}
                      </p>
                      {status === "current" && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 font-medium">
                          Current Stage
                        </span>
                      )}
                    </div>
                    {historyEntry && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(historyEntry.changedAt)}
                        {historyEntry.notes ? ` · ${historyEntry.notes}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Offer Details */}
      {candidate.offerDetail && (
        <Card>
          <CardHeader><CardTitle>Offer Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {candidate.offerDetail.offeredSalary && (
              <div className="flex justify-between">
                <span className="text-gray-500">Offered Salary</span>
                <span className="font-semibold">₹{candidate.offerDetail.offeredSalary.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Offer Date</span>
              <span>{formatDate(candidate.offerDetail.offeredAt)}</span>
            </div>
            {candidate.offerDetail.probationEndAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Probation Ends</span>
                <span>{formatDate(candidate.offerDetail.probationEndAt)}</span>
              </div>
            )}
            {candidate.offerDetail.notes && (
              <div>
                <p className="text-gray-500 mb-1">Notes</p>
                <p className="text-gray-700">{candidate.offerDetail.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Important Notice */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> If you need to update any submitted information or documents, please contact HR directly. Candidates cannot modify submitted data through this portal.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
