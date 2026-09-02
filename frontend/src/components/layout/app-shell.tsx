"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/lib/auth/use-session";
import { useClinicStore } from "@/lib/store/clinic-store";
import { canAccessRoute, defaultRouteByRole } from "@/lib/permissions/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { Forbidden } from "@/components/shared/forbidden";
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

export function AppShell({ children }: { children: ReactNode }) {
  const hasHydrated = useClinicStore((s) => s.hasHydrated);
  const dataLoaded = useClinicStore((s) => s.dataLoaded);
  const loading = useClinicStore((s) => s.loading);
  const loadError = useClinicStore((s) => s.loadError);
  const refresh = useClinicStore((s) => s.refresh);
  const { user, isAuthenticated } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hasHydrated, isAuthenticated, router]);

  // The clinic collections live on the server, so they are read once the
  // session is known and again whenever the user asks for a reload.
  useEffect(() => {
    if (hasHydrated && isAuthenticated && !dataLoaded && !loading && !loadError) {
      void refresh();
    }
  }, [hasHydrated, isAuthenticated, dataLoaded, loading, loadError, refresh]);

  if (!hasHydrated) return <FullScreenLoader />;
  if (!user || !isAuthenticated) return <FullScreenLoader />;
  if (loadError && !dataLoaded) return <LoadFailure message={loadError} onRetry={() => void refresh()} />;
  if (!dataLoaded) return <FullScreenLoader message="Loading clinic data…" />;

  const allowed = canAccessRoute(user.role, pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col overflow-y-auto outline-none">
          {allowed ? (
            <div className="flex flex-1 flex-col p-4 lg:p-6">{children}</div>
          ) : (
            <Forbidden homeHref={defaultRouteByRole[user.role] ?? "/login"} />
          )}
        </main>
      </div>
    </div>
  );
}
