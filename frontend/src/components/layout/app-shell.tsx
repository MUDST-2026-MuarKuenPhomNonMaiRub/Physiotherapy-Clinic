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
import { ClinicLogo } from "@/components/layout/clinic-logo";

function FullScreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <ClinicLogo className="h-11 w-11 animate-pulse text-primary" />
        <p className="text-sm text-muted-foreground">Loading LA BALANCE…</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const hasHydrated = useClinicStore((s) => s.hasHydrated);
  const hydrateFromApi = useClinicStore((s) => s.hydrateFromApi);
  const { user, accessToken, isAuthenticated } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const apiHydrationStarted = useRef(false);

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hasHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !accessToken || apiHydrationStarted.current) return;
    apiHydrationStarted.current = true;
    void hydrateFromApi(accessToken);
  }, [hasHydrated, isAuthenticated, accessToken, hydrateFromApi]);

  if (!hasHydrated) return <FullScreenLoader />;
  if (!user || !isAuthenticated) return <FullScreenLoader />;

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
