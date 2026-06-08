"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, FileText, Users, Building2, Globe, Settings,
  LogOut, ChevronDown, ClipboardList, BarChart3, FolderOpen, UserCheck, Mail
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  children?: { label: string; href: string }[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "MRFs",
    href: "/dashboard/mrfs",
    icon: ClipboardList,
    roles: ["ADMIN", "HR", "BRANCH_MANAGER", "DIVISIONAL_MANAGER", "FUNCTIONAL_HEAD", "COUNTRY_MANAGER"],
  },
  {
    label: "Candidates",
    href: "/dashboard/candidates",
    icon: Users,
    roles: ["ADMIN", "HR"],
  },
  {
    label: "Documents",
    href: "/dashboard/documents",
    icon: FolderOpen,
    roles: ["ADMIN", "HR"],
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    roles: ["ADMIN", "HR"],
  },
  {
    label: "Organization",
    href: "/dashboard/org",
    icon: Building2,
    roles: ["ADMIN"],
    children: [
      { label: "Countries & Branches", href: "/dashboard/org/countries" },
      { label: "Departments", href: "/dashboard/org/departments" },
      { label: "Designations", href: "/dashboard/org/designations" },
    ],
  },
  {
    label: "Users",
    href: "/dashboard/users",
    icon: Users,
    roles: ["ADMIN", "HR"],
  },
  {
    label: "Employees",
    href: "/dashboard/employees",
    icon: UserCheck,
    roles: ["ADMIN", "HR"],
  },
  {
    label: "Email",
    href: "/dashboard/email",
    icon: Mail,
    roles: ["ADMIN", "HR"],
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["ADMIN"],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const role = (session?.user as { role?: string })?.role || "";

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  };

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900 text-white">
      <div className="flex h-16 items-center gap-2 border-b border-gray-700 px-6">
        <Globe className="h-6 w-6 text-blue-400" />
        <span className="text-lg font-bold">RecruitPro ERP</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === item.href || pathname.startsWith(item.href + "/");
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openMenus[item.label];

            return (
              <li key={item.href}>
                {hasChildren ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.label)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <ul className="ml-7 mt-1 space-y-1">
                        {item.children!.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className={cn(
                                "block rounded-md px-3 py-1.5 text-sm transition-colors",
                                pathname === child.href
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
                              )}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-gray-700 p-4">
        <div className="mb-3 px-3">
          <p className="text-sm font-medium text-white">{session?.user?.name}</p>
          <p className="text-xs text-gray-400">{session?.user?.email}</p>
          <span className="mt-1 inline-block rounded-full bg-blue-600/30 px-2 py-0.5 text-xs text-blue-300">
            {role.replace(/_/g, " ")}
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
