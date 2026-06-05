"use client";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useSession } from "next-auth/react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/mrfs": "Manpower Requisition Forms",
  "/dashboard/mrfs/new": "New MRF",
  "/dashboard/candidates": "Candidates",
  "/dashboard/documents": "Documents",
  "/dashboard/reports": "Reports",
  "/dashboard/org/countries": "Countries & Branches",
  "/dashboard/org/departments": "Departments",
  "/dashboard/org/designations": "Designations",
  "/dashboard/users": "User Management",
  "/dashboard/settings": "Settings",
  "/dashboard/my-application": "My Application",
};

export default function Topbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const title = pageTitles[pathname] || "RecruitPro ERP";

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-4">
        <button className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100">
          <Bell className="h-5 w-5" />
        </button>
        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
          {session?.user?.name?.[0]?.toUpperCase() || "U"}
        </div>
      </div>
    </header>
  );
}
