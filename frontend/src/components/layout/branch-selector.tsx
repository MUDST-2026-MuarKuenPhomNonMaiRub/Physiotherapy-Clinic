"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { useSession } from "@/lib/auth/use-session";
import { useClinicStore } from "@/lib/store/clinic-store";
import { today } from "@/lib/domain";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Branch } from "@/types";

/**
 * One colour per branch, so staff can tell at a glance which branch they are
 * working in. Assigned by branch code across every branch (not only the ones
 * this user can open), so a branch keeps its colour for everyone.
 */
const BRANCH_DOTS = [
  "bg-emerald-400",
  "bg-sky-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-violet-400",
  "bg-teal-400",
];

/** Bookings that no longer take up the day. */
const RELEASED = ["CANCELLED", "RESCHEDULED", "NO_SHOW"];

function useBranchChoices() {
  const { user, activeBranchId, setActiveBranch } = useSession();
  const branches = useClinicStore((s) => s.branches);
  const appointments = useClinicStore((s) => s.appointments);

  return useMemo(() => {
    const dotOf = new Map(
      [...branches]
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((branch, i) => [branch.id, BRANCH_DOTS[i % BRANCH_DOTS.length]])
    );
    const day = today();
    const bookedToday = new Map<string, number>();
    for (const a of appointments) {
      if (a.date !== day || RELEASED.includes(a.status)) continue;
      bookedToday.set(a.branchId, (bookedToday.get(a.branchId) ?? 0) + 1);
    }
    const accessible = user
      ? branches.filter((branch) => branch.status === "ACTIVE" && user.branchIds.includes(branch.id))
      : [];
    const current = accessible.find((b) => b.id === activeBranchId) ?? accessible[0];
    const choose = (branch: Branch) => {
      if (branch.id === current?.id) return;
      setActiveBranch(branch.id);
      toast.success(`Now working at ${branch.name}`);
    };
    return {
      accessible,
      current,
      choose,
      dotOf: (id: string) => dotOf.get(id) ?? BRANCH_DOTS[0],
      todayCount: (id: string) => bookedToday.get(id) ?? 0,
    };
  }, [user, activeBranchId, setActiveBranch, branches, appointments]);
}

function bookingsLabel(count: number) {
  return count === 1 ? "1 booking today" : `${count} bookings today`;
}

function BranchOptions({ choices }: { choices: ReturnType<typeof useBranchChoices> }) {
  const { accessible, current, choose, dotOf, todayCount } = choices;
  return (
    <>
      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Switch branch</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {accessible.map((b) => (
        <DropdownMenuItem key={b.id} onClick={() => choose(b)} className="flex items-start gap-2.5 py-2">
          <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotOf(b.id))} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug">{b.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-mono">{b.code}</span>
              <span aria-hidden="true"> · </span>
              <span>{bookingsLabel(todayCount(b.id))}</span>
            </p>
          </div>
          {b.id === current?.id && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/**
 * Branch names are written "สาขา …"; the switcher already reads as the branch,
 * so the button drops the prefix to fit the part that tells branches apart.
 * The list keeps the full name.
 */
function shortName(name: string) {
  return name.replace(/^(สาขา|Branch)\s*/i, "") || name;
}

/**
 * The branch switcher in the header, next to the content it scopes. Kept on
 * the phone layout too: a branch switch is the one control that changes what
 * every screen shows. A user with one branch sees it as a plain label.
 */
export function BranchSelector({ className }: { className?: string }) {
  const choices = useBranchChoices();
  const { accessible, current, dotOf } = choices;
  if (!current) return null;

  const label = (
    <>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotOf(current.id))} aria-hidden="true" />
      <span className="hidden min-w-0 truncate sm:inline">{shortName(current.name)}</span>
      <span className="truncate font-mono sm:hidden">{current.code}</span>
      <span className="hidden shrink-0 rounded bg-muted px-1.5 py-px font-mono text-[10px] font-semibold text-muted-foreground xl:inline">
        {current.code}
      </span>
    </>
  );

  if (accessible.length <= 1) {
    return (
      <div
        className={cn("flex h-9 max-w-44 shrink-0 items-center gap-2 px-1 text-sm text-muted-foreground sm:max-w-64 xl:max-w-80", className)}
        title={current.name}
      >
        {label}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex h-9 max-w-44 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted data-[state=open]:bg-muted sm:max-w-64 xl:max-w-80",
            className
          )}
          title={current.name}
          aria-label={`Branch: ${current.name}. Switch branch`}
        >
          {label}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(18rem,calc(100vw-2rem))]">
        <BranchOptions choices={choices} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
