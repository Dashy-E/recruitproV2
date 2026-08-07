"use client";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Plus, Search, ClipboardList, Users, Bell, Loader2 } from "lucide-react";
import { formatDate, MRF_STATUSES } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface MRF {
  id: string;
  referenceNumber: string;
  mrfNumber: string | null;
  title: string;
  status: string;
  vacancyCount: number;
  createdAt: string;
  orgUnit: { name: string; path: string } | null;
  department: { name: string };
  createdBy: { name: string };
  _count: { candidates: number };
  // Server-computed org/department-scoped eligibility — see src/lib/mrf-approval.ts.
  canApprove: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary",
  PENDING_DIVISIONAL: "warning",
  PENDING_COUNTRY_SUPERVISOR: "warning",
  PENDING_FUNCTIONAL: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

function MRFsContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const orgUnitFilter = searchParams.get("orgUnit") || "";
  const permissions = (session?.user as { permissions?: string[] })?.permissions || [];
  const approvalLevel = (session?.user as { approvalLevel?: string | null })?.approvalLevel ?? null;
  const [mrfs, setMrfs] = useState<MRF[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const canCreate = permissions.includes("CREATE_MRF");
  // Server-computed (org/department-scoped) — not universal "ANY" approvers,
  // who see everything and don't need a "pending for me" banner.
  const pendingForMe = approvalLevel && approvalLevel !== "ANY" ? mrfs.filter((m) => m.canApprove) : [];

  useEffect(() => {
    setLoading(true);
    const url = orgUnitFilter ? `/api/mrfs?orgUnit=${orgUnitFilter}` : "/api/mrfs";
    fetch(url)
      .then((r) => r.json())
      .then((data) => { setMrfs(Array.isArray(data) ? data : []); setLoading(false); });
  }, [orgUnitFilter]);

  const filtered = mrfs.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.mrfNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      m.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      m.department.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.orgUnit?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const MRFRow = ({ mrf }: { mrf: MRF }) => (
    <TableRow>
      <TableCell className="font-mono text-xs">{mrf.mrfNumber || mrf.referenceNumber}</TableCell>
      <TableCell className="font-medium">{mrf.title}</TableCell>
      <TableCell>
        <p className="text-sm">{mrf.orgUnit?.path || mrf.orgUnit?.name || "—"}</p>
      </TableCell>
      <TableCell>{mrf.department.name}</TableCell>
      <TableCell className="text-center">{mrf.vacancyCount}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3 text-gray-400" />
          <span>{mrf._count.candidates}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_COLORS[mrf.status] as "secondary" | "warning" | "success" | "destructive" | "default" | "outline"}>
          {MRF_STATUSES[mrf.status as keyof typeof MRF_STATUSES]?.label || mrf.status}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-gray-500">{formatDate(mrf.createdAt)}</TableCell>
      <TableCell>
        <Link href={`/dashboard/mrfs/${mrf.id}`} className="text-sm text-blue-600 hover:underline">
          View
        </Link>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manpower Requisition Forms</h2>
          <p className="text-sm text-gray-500 mt-1">{mrfs.length} total MRFs</p>
        </div>
        {canCreate && (
          <Link href="/dashboard/mrfs/new">
            <Button>
              <Plus className="h-4 w-4" />
              New MRF
            </Button>
          </Link>
        )}
      </div>

      {/* Pending approval banner for managers */}
      {pendingForMe.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-800 text-base">
              <Bell className="h-5 w-5" />
              {pendingForMe.length} MRF{pendingForMe.length > 1 ? "s" : ""} awaiting your approval
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MRF Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Org Unit</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Vacancies</TableHead>
                  <TableHead>Candidates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingForMe.map((mrf) => <MRFRow key={mrf.id} mrf={mrf} />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Object.entries(MRF_STATUSES).map(([key, val]) => (
          <Card key={key}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-gray-500">{val.label}</p>
              <p className="text-2xl font-bold mt-1">{mrfs.filter((m) => m.status === key).length}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search MRFs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <ClipboardList className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p>No MRFs found.</p>
              {canCreate && (
                <Link href="/dashboard/mrfs/new" className="mt-2 inline-block text-blue-600 hover:underline text-sm">
                  Create your first MRF
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MRF Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Org Unit</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Vacancies</TableHead>
                  <TableHead>Candidates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((mrf) => <MRFRow key={mrf.id} mrf={mrf} />)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MRFsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>}>
      <MRFsContent />
    </Suspense>
  );
}
