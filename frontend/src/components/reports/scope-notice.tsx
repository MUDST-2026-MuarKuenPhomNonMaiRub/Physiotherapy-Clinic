import { UserRound } from "lucide-react";

/** Shown on a report a physiotherapist sees narrowed to themselves. */
export function ScopeNotice({ name }: { name: string }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-info/25 bg-info/5 px-3.5 py-2.5">
      <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[#1A9DBF]" />
      <p className="text-sm text-foreground">
        Showing <span className="font-medium">{name}</span> only. Clinic-wide figures are
        available to Admins.
      </p>
    </div>
  );
}
