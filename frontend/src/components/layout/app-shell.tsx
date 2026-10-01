"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/lib/auth/use-session";
import { useClinicStore } from "@/lib/store/clinic-store";
import { canAccessRoute, defaultRouteByRole } from "@/lib/permissions/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { Forbidden } from "@/components/shared/forbidden";
import { GoogleReturnNotice } from "@/components/integrations/google-return-notice";
import { ClinicLogo } from "@/components/layout/clinic-logo";
import { Button } from "@/components/ui/button";

function FullScreenLoader({ message = "Loading LA BALANCE…" }: { message?: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <ClinicLogo className="h-11 w-11 animate-pulse text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function LoadFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <ClinicLogo className="h-11 w-11 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Cannot load clinic data</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}

/**
 * How often coming back to the tab may re-read the server. Focus and
 * visibilitychange both fire on a single tab switch, and staff switch tabs all
 * day; re-reading every patient, visit and transaction each time grows with the
 * clinic's history. The profile is cheap and guards the menus, so it is re-read
 * more often than the operational lists.
 */
const PROFILE_REVALIDATE_MS = 60_000;
const OPERATIONAL_REVALIDATE_MS = 5 * 60_000;

/** The parts of the profile that decide which branches' data this tab may hold. */
function accessKey(user: { role: string; branchIds?: string[] } | null | undefined) {
  return user ? `${user.role}:${[...(user.branchIds ?? [])].sort().join(",")}` : "";
}

export function AppShell({ children }: { children: ReactNode }) {
  const hasHydrated = useClinicStore((s) => s.hasHydrated);
  const dataLoaded = useClinicStore((s) => s.dataLoaded);
  const loading = useClinicStore((s) => s.loading);
  const loadError = useClinicStore((s) => s.loadError);
  const operationalLoading = useClinicStore((s) => s.operationalLoading);
  const refresh = useClinicStore((s) => s.refresh);
  const refreshOperational = useClinicStore((s) => s.refreshOperational);
  const { user, isAuthenticated } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const lastProfileRead = useRef(0);
  const lastOperationalRead = useRef(0);

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hasHydrated, isAuthenticated, router]);

  // The app shell owns the scroll container rather than the browser window.
  // Reset it on navigation so a long page never opens with its page title
  // tucked underneath the fixed-height header.
  useEffect(() => {
    document.getElementById("main-content")?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  // The clinic collections live on the server, so they are read once the
  // session is known and again whenever the user asks for a reload.
  useEffect(() => {
    if (hasHydrated && isAuthenticated && !dataLoaded && !loading && !loadError) {
      void refresh();
    }
  }, [hasHydrated, isAuthenticated, dataLoaded, loading, loadError, refresh]);

  // Load large operational collections after the shell is usable. The login
  // request should not wait for every patient, visit and transaction row.
  useEffect(() => {
    if (dataLoaded && isAuthenticated) {
      lastProfileRead.current = Date.now();
      lastOperationalRead.current = Date.now();
      void refreshOperational();
    }
  }, [dataLoaded, isAuthenticated, refreshOperational]);

  // Permissions can be changed by an administrator in another tab. Re-read
  // the profile when this tab becomes active so menus and route guards do not
  // continue using stale access for the rest of the session — at most once a
  // minute. The operational lists follow every five minutes, or at once when
  // the account's branches changed or they never finished loading.
  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState !== "visible" || !isAuthenticated || !dataLoaded) return;
      const now = Date.now();
      if (now - lastProfileRead.current < PROFILE_REVALIDATE_MS) return;
      lastProfileRead.current = now;
      const accessBefore = accessKey(useClinicStore.getState().session.user);
      void refresh().then(() => {
        const state = useClinicStore.getState();
        const due =
          now - lastOperationalRead.current >= OPERATIONAL_REVALIDATE_MS ||
          !state.operationalLoaded ||
          accessKey(state.session.user) !== accessBefore;
        if (!due) return;
        lastOperationalRead.current = now;
        return refreshOperational();
      });
    };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [isAuthenticated, dataLoaded, refresh, refreshOperational]);

  if (!hasHydrated) return <FullScreenLoader />;
  if (!user || !isAuthenticated) return <FullScreenLoader />;
  if (loadError && !dataLoaded) return <LoadFailure message={loadError} onRetry={() => void refresh()} />;
  if (!dataLoaded) return <FullScreenLoader message="Loading clinic data…" />;

  const allowed = canAccessRoute(user.role, pathname, user.permissions);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <GoogleReturnNotice />
      {loadError && dataLoaded && (
        <div className="fixed right-4 top-20 z-40 flex max-w-md items-center gap-3 rounded-lg border border-destructive/30 bg-background px-4 py-3 text-sm shadow-lg">
          <p className="flex-1 text-destructive">{loadError}</p>
          <Button size="sm" variant="outline" onClick={() => void refreshOperational()} disabled={operationalLoading}>
            {operationalLoading ? "Retrying…" : "Retry"}
          </Button>
        </div>
      )}
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col overflow-y-auto outline-none">
          {allowed ? (
            // Capped on very wide monitors so tables and forms do not stretch
            // into unreadably long rows; the cap sits well above a 1920px
            // display at 125% scaling, the common office setup.
            <div className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col p-4 lg:p-6 2xl:px-8">{children}</div>
          ) : (
            <Forbidden homeHref={defaultRouteByRole[user.role] ?? "/login"} />
          )}
        </main>
      </div>
    </div>
  );
}
