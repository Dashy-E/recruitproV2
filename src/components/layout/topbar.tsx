"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useSession } from "next-auth/react";
import { formatDate } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

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
  "/dashboard/approvals": "Approval Portal",
  "/dashboard/settings/stages": "Workflow Stages",
  "/dashboard/employee-portal": "Employee Portal",
  "/dashboard/employees": "Employees",
  "/dashboard/email": "Email",
};

export default function Topbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const title = pageTitles[pathname] || "RecruitPro ERP";

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const fetchNotifications = async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    }
  };

  useEffect(() => {
    if (session) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [session]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative" ref={panelRef}>
          <button
            className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100"
            onClick={() => setOpen((o) => !o)}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-xl z-50">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-900">
                  Notifications {unreadCount > 0 && <span className="ml-1 rounded-full bg-red-100 text-red-700 text-xs px-1.5 py-0.5">{unreadCount} new</span>}
                </span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <CheckCheck className="h-3 w-3" /> Mark all read
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">
                    <Bell className="mx-auto h-6 w-6 mb-2 opacity-30" />
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-default
                        ${!n.isRead ? "bg-blue-50/40" : ""}`}
                      onClick={() => { if (!n.isRead) markRead(n.id); }}
                    >
                      <div className="flex items-start gap-2">
                        {!n.isRead && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
                        <div className={`flex-1 min-w-0 ${n.isRead ? "pl-3.5" : ""}`}>
                          <p className={`text-xs font-medium ${n.isRead ? "text-gray-700" : "text-gray-900"}`}>{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.message}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-400">{formatDate(n.createdAt)}</span>
                            {n.link && (
                              <Link
                                href={n.link}
                                className="flex items-center gap-0.5 text-xs text-blue-600 hover:underline"
                                onClick={() => setOpen(false)}
                              >
                                <ExternalLink className="h-3 w-3" /> View
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
          {session?.user?.name?.[0]?.toUpperCase() || "U"}
        </div>
      </div>
    </header>
  );
}
