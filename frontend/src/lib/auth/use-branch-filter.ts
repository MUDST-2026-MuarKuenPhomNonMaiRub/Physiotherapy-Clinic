"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth/use-session";

/**
 * A page's branch filter, starting on the branch the user is working in and
 * following it when they switch: a page left on the old branch while the
 * switcher shows the new one invites booking or billing in the wrong place.
 * The user can still widen it to "ALL" or pick another branch on the page.
 */
export function useBranchFilter() {
  const { activeBranchId } = useSession();
  const [filter, setFilter] = useState(activeBranchId ?? "ALL");
  const [followed, setFollowed] = useState(activeBranchId);
  if (followed !== activeBranchId) {
    setFollowed(activeBranchId);
    setFilter(activeBranchId ?? "ALL");
  }
  return [filter, setFilter] as const;
}
