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
    (b) => b.status === "ACTIVE" && (user.role === "ADMIN" || user.branchIds.includes(b.id))
  );
  if (accessible.length <= 1) {
    const only = accessible[0];
    if (!only) return null;
    return (
      <div className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground sm:flex">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        {only.name}
      </div>
    );
  }

  const current = branches.find((b) => b.id === activeBranchId) ?? accessible[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hidden cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:flex">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          {current?.name ?? "Select Branch"}
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
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
