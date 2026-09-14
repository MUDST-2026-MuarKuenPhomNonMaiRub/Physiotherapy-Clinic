"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useSession } from "@/lib/auth/use-session";
import { useClinicStore } from "@/lib/store/clinic-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function BranchSelector() {
  const { user, activeBranchId, setActiveBranch } = useSession();
  const branches = useClinicStore((s) => s.branches);

  if (!user) return null;

  const accessible = branches.filter(
    (branch) => branch.status === "ACTIVE" && user.branchIds.includes(branch.id)
  );
  if (accessible.length <= 1) {
    const only = accessible[0];
    if (!only) return null;
    return (
      <div
        className="flex h-9 max-w-44 shrink-0 items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 text-sm text-foreground sm:max-w-56"
        title={only.name}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="hidden truncate sm:inline">{only.name}</span>
        <span className="truncate sm:hidden">{only.code}</span>
      </div>
    );
  }

  const current = accessible.find((b) => b.id === activeBranchId) ?? accessible[0];

  // Kept on the phone layout as well: a branch switch is the one header
  // control that changes what every screen shows.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-9 max-w-44 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:max-w-56"
          title={current?.name}
          aria-label={`Branch: ${current?.name ?? "none"}`}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="hidden truncate sm:inline">{current?.name ?? "Select Branch"}</span>
          <span className="truncate sm:hidden">{current?.code ?? "Branch"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(16rem,calc(100vw-2rem))]">
        {accessible.map((b) => (
          <DropdownMenuItem key={b.id} onClick={() => setActiveBranch(b.id)} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{b.name}</p>
              <p className="text-xs text-muted-foreground">{b.code}</p>
            </div>
            {b.id === current?.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
