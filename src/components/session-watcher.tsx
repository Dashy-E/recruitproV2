"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession, getSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { sessionFlags } from "@/lib/session-flags";

export default function SessionWatcher() {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const wasAuthenticated = useRef(false);
  const expiredRef = useRef(false);
  const checkingRef = useRef(false);
  const [expired, setExpired] = useState(false);

  const showExpired = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    wasAuthenticated.current = false;
    setExpired(true);
  }, []);

  // Periodic/focus-triggered refetch (see providers.tsx) updates `status`.
  useEffect(() => {
    if (status === "authenticated") {
      wasAuthenticated.current = true;
      return;
    }

    if (status === "unauthenticated" && wasAuthenticated.current) {
      // An intentional sign-out already redirects on its own — don't show
      // the "expired" dialog on top of it.
      if (sessionFlags.manualSignOut) {
        sessionFlags.manualSignOut = false;
        wasAuthenticated.current = false;
        return;
      }
      if (pathname !== "/login") {
        showExpired();
      } else {
        wasAuthenticated.current = false;
      }
    }
  }, [status, pathname, showExpired]);

  // Don't wait for the next periodic poll — check the instant the user
  // interacts with the page anywhere, so expiry surfaces immediately.
  useEffect(() => {
    if (pathname === "/login") return;

    const handleInteraction = async () => {
      if (expiredRef.current || checkingRef.current || !wasAuthenticated.current) return;
      checkingRef.current = true;
      try {
        const current = await getSession();
        if (!current?.user && wasAuthenticated.current && !sessionFlags.manualSignOut) {
          showExpired();
        }
      } finally {
        checkingRef.current = false;
      }
    };

    document.addEventListener("click", handleInteraction);
    return () => document.removeEventListener("click", handleInteraction);
  }, [pathname, showExpired]);

  const handleAcknowledge = () => {
    setExpired(false);
    expiredRef.current = false;
    router.push("/login");
    router.refresh();
  };

  return (
    <Dialog open={expired}>
      <DialogContent
        hideCloseButton
        className="max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle className="mt-3">Session Expired</DialogTitle>
          <DialogDescription>
            Your session has ended for security reasons. Please sign in again to continue.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={handleAcknowledge} className="w-full sm:w-auto sm:px-10">
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
