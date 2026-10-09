"use client";

import { useSession } from "@/lib/auth/use-session";

/**
 * Reports are open to both roles, but only an Admin sees clinic-wide figures.
 * A physiotherapist gets the same report narrowed to their own row — their
 * sales, their commission — across the branches they work at.
 */
export function useReportScope() {
  const { user, can } = useSession();
  const seesEveryone = can("report.view.all");
  return {
    seesEveryone,
    ownStaffId: user?.staffId ?? null,
    ownName: user?.displayName ?? "",
  };
}
