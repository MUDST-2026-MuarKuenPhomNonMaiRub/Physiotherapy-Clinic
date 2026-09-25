"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClinicStore } from "@/lib/store/clinic-store";
import { defaultRouteByRole } from "@/lib/permissions/navigation";
import { me } from "@/lib/api/clinic-api";
import { Activity } from "lucide-react";

export default function RootPage() {
  const router = useRouter();
  const hasHydrated = useClinicStore((s) => s.hasHydrated);
  const user = useClinicStore((s) => s.session.user);
  const logout = useClinicStore((s) => s.logout);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    let active = true;
    void me()
      .then(() => {
        if (active) router.replace(defaultRouteByRole[user.role] ?? "/login");
      })
      .catch(() => {
        if (!active) return;
        logout();
        router.replace("/login");
      });

    return () => {
      active = false;
    };
  }, [hasHydrated, user, logout, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground">Loading PhysioCare Clinic…</p>
      </div>
    </div>
  );
}
