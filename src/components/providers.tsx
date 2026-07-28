"use client";
import { SessionProvider } from "next-auth/react";
import SessionWatcher from "@/components/session-watcher";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    // TEMPORARY: fast refetch to match auth.ts's 10-second test session maxAge.
    <SessionProvider refetchInterval={5} refetchOnWindowFocus>
      <SessionWatcher />
      {children}
    </SessionProvider>
  );
}
