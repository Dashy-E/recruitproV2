import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";

const DOC_TYPE_COLORS: Record<string, string> = {
  IDENTIFICATION: "bg-blue-100 text-blue-700",
  RECRUITMENT: "bg-purple-100 text-purple-700",
  MRF_APPROVAL: "bg-green-100 text-green-700",
  ONBOARDING: "bg-orange-100 text-orange-700",
  OTHER: "bg-gray-100 text-gray-600",
};

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) redirect("/dashboard");

  const documents = await prisma.document.findMany({
    include: {
      uploadedBy: { select: { name: true } },
      candidate: { select: { firstName: true, lastName: true } },
      mrf: { select: { mrfNumber: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const docsByType = documents.reduce<Record<string, number>>((acc, d) => {
    acc[d.documentType] = (acc[d.documentType] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Document Management</h2>
        <p className="text-sm text-gray-500 mt-1">{documents.length} documents stored</p>
      </div>

      {/* Type Summary */}
      <div className="flex flex-wrap gap-3">
        {["MRF_APPROVAL", "IDENTIFICATION", "RECRUITMENT", "ONBOARDING", "OTHER"].map((type) => (
          <div key={type} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${DOC_TYPE_COLORS[type]}`}>
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">{type.replace("_", " ")}</span>
            <span className="font-bold">{docsByType[type] || 0}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <FolderOpen className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p>No documents uploaded yet.</p>
              <p className="text-sm mt-1">Documents will appear here when HR uploads approval records or candidate submissions arrive.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.name}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DOC_TYPE_COLORS[doc.documentType]}`}>
                        {doc.documentType.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {doc.candidate
                        ? <span className="text-purple-600">{doc.candidate.firstName} {doc.candidate.lastName}</span>
                        : doc.mrf
                        ? <span className="text-blue-600">{doc.mrf.mrfNumber}</span>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{doc.uploadedBy.name}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {doc.fileSize > 1024 * 1024
                        ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`
                        : `${Math.round(doc.fileSize / 1024)} KB`}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(doc.createdAt)}</TableCell>
                    <TableCell>
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        View
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
