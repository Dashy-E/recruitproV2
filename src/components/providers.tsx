"use client";
import { SessionProvider } from "next-auth/react";
import SessionWatcher from "@/components/session-watcher";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    // No refetchInterval: a timer-based poll would "touch" the session on
    // its own and keep extending it even while the user is genuinely idle,
    // defeating the 30-minute inactivity timeout (see auth.ts). Real clicks
    // (SessionWatcher) and window focus are what should keep a session alive.
    <SessionProvider refetchOnWindowFocus>
      <SessionWatcher />
      {children}
    </SessionProvider>
  );
}
