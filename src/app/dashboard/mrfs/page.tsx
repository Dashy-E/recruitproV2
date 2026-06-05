"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Plus, Search, ClipboardList, Users } from "lucide-react";
import { formatDate, MRF_STATUSES } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface MRF {
  id: string;
  mrfNumber: string;
  title: string;
  status: string;
  vacancyCount: number;
  createdAt: string;
  country: { name: string };
  branch: { name: string };
  department: { name: string };
  createdBy: { name: string };
  _count: { candidates: number };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary",
  PENDING_DIVISIONAL: "warning",
  PENDING_FUNCTIONAL: "warning",
  PENDING_COUNTRY: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

export default function MRFsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const [mrfs, setMrfs] = useState<MRF[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const canCreate = ["ADMIN", "HR", "BRANCH_MANAGER"].includes(role);

  useEffect(() => {
    fetch("/api/mrfs")
      .then((r) => r.json())
      .then((data) => { setMrfs(data); setLoading(false); });
  }, []);

  const filtered = mrfs.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.mrfNumber.toLowerCase().includes(search.toLowerCase()) ||
      m.department.name.toLowerCase().includes(search.toLowerCase()) ||
      m.branch.name.toLowerCase().includes(search.toLowerCase())
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
                  <TableHead>Country / Branch</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Vacancies</TableHead>
                  <TableHead>Candidates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((mrf) => (
                  <TableRow key={mrf.id}>
                    <TableCell className="font-mono text-xs">{mrf.mrfNumber}</TableCell>
                    <TableCell className="font-medium">{mrf.title}</TableCell>
                    <TableCell>
                      <p className="text-sm">{mrf.country.name}</p>
                      <p className="text-xs text-gray-500">{mrf.branch.name}</p>
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
