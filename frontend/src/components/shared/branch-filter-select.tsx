"use client";

import { Building2 } from "lucide-react";
import { useBranchScope } from "@/lib/auth/use-branch-scope";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function BranchFilterSelect({
  value,
  onValueChange,
  className = "w-44",
}: {
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
}) {
  const { options, canSeeAll } = useBranchScope();

  if (!canSeeAll) {
    const only = options[0];
    if (!only) return null;
    // One accessible branch: a read-only chip that sizes to its label rather
    // than the caller's filter width, so long Thai branch names don't wrap.
    return (
      <div
        className={cn(
          "flex items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground",
          className,
          "w-auto"
        )}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {only.name}
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}><SelectValue placeholder="Branch" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">All Branches</SelectItem>
        {options.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
