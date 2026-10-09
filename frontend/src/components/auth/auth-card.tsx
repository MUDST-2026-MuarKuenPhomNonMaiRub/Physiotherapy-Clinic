import type { ReactNode } from "react";
import { ClinicLogo } from "@/components/layout/clinic-logo";
import { LanguageToggle } from "@/components/i18n/language-toggle";

/** The centred, signed-out frame shared by the password recovery pages. */
export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <LanguageToggle className="absolute right-4 top-4 sm:right-6 sm:top-6" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <ClinicLogo className="h-10 w-10 text-primary" />
          <div className="leading-none">
            <p className="font-heading text-base font-bold tracking-[0.14em] text-primary">LA BALANCE</p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Physical Therapy Clinic
            </p>
          </div>
        </div>
        <h1 className="font-heading text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
