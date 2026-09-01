"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Loader2,
  LockKeyhole,
  Percent,
  Ticket,
  Building2,
} from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { loginWithApi } from "@/lib/auth/auth-api";
import { useSession } from "@/lib/auth/use-session";
import { defaultRouteByRole } from "@/lib/permissions/navigation";
import { ClinicLogo } from "@/components/layout/clinic-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LucideIcon } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const setAuthenticatedSession = useClinicStore((s) => s.setAuthenticatedSession);
  const hasHydrated = useClinicStore((s) => s.hasHydrated);
  const { user, isAuthenticated } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasHydrated && isAuthenticated && user) {
      router.replace(defaultRouteByRole[user.role] ?? "/login");
    }
  }, [hasHydrated, isAuthenticated, user, router]);

  async function submit(u: string, p: string) {
    setError(null);
    setLoading(true);
    try {
      const result = await loginWithApi(u, p);
      setAuthenticatedSession(result.user, result.accessToken);
      setLoading(false);
      router.replace(defaultRouteByRole[result.user.role] ?? "/login");
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(username, password);
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-sidebar px-12 py-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <ClinicLogo className="h-10 w-10 text-white" />
          <div className="leading-none">
            <p className="font-heading text-base font-bold tracking-[0.14em]">LA BALANCE</p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-white/55">
              Physical Therapy Clinic
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-heading text-[34px] font-semibold leading-[1.15] text-white">
            One system for the whole clinic floor.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/65">
            Whoever is on shift books the room, treats the patient, takes payment and
            closes the day. Two access levels, no hand-offs.
          </p>
          <div className="mt-9 grid grid-cols-2 gap-4">
            <FeaturePoint icon={CalendarCheck} label="Calendar & Visits" />
            <FeaturePoint icon={Ticket} label="Course Balances" />
            <FeaturePoint icon={Building2} label="Multi-Branch" />
            <FeaturePoint icon={Percent} label="Commission & Reports" />
          </div>
        </div>

        <p className="relative text-xs text-white/40">
          © 2026 LA BALANCE Physical Therapy Clinic · Interactive product mock-up — no real data.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-1 items-center justify-center px-6 py-12 lg:w-[54%]">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <ClinicLogo className="h-10 w-10 text-primary" />
            <div className="leading-none">
              <p className="font-heading text-base font-bold tracking-[0.14em] text-primary">LA BALANCE</p>
              <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Physical Therapy Clinic
              </p>
            </div>
          </div>

          <h2 className="font-heading text-xl font-semibold text-foreground">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your clinic account.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Email</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin@example.com"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                  className="h-10 pl-8"
                />
              </div>
            </div>
            {error && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="h-10 w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}

function FeaturePoint({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-white/85">
      <Icon className="h-4 w-4 text-sidebar-section" />
      {label}
    </div>
  );
}
