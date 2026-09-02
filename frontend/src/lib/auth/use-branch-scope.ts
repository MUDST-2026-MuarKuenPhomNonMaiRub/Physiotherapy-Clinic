"use client";

import { useMemo } from "react";
import { useSession } from "@/lib/auth/use-session";
import { useClinicStore } from "@/lib/store/clinic-store";

/**
 * Restricts branch filter UI/data to the branches the current user is allowed to see.
 * "ALL" in a branch filter means "all of my accessible branches", not every branch
 * in the system — isAccessible() enforces that when a filter predicate resolves "ALL".
 */
export function useBranchScope() {
  const { user } = useSession();
  const branches = useClinicStore((s) => s.branches);

  return useMemo(() => {
    const options = user
      ? user.role === "ADMIN"
        ? branches.filter((b) => b.status === "ACTIVE")
        : branches.filter((b) => user.branchIds.includes(b.id) && b.status === "ACTIVE")
      : [];
    const canSeeAll = options.length > 1;
    const isAccessible = (branchId: string) =>
      !user || user.role === "ADMIN" || user.branchIds.includes(branchId);
    return { options, canSeeAll, isAccessible };
  }, [user, branches]);
}
