"use client";

import { useClinicStore } from "@/lib/store/clinic-store";
import { hasPermission } from "@/lib/permissions";
import type { Permission } from "@/types";

export function useSession() {
  const user = useClinicStore((s) => s.session.user);
  const activeBranchId = useClinicStore((s) => s.session.activeBranchId);
  const accessToken = useClinicStore((s) => s.session.accessToken);
  const setActiveBranch = useClinicStore((s) => s.setActiveBranch);
  const logout = useClinicStore((s) => s.logout);

  const can = (permission: Permission) => (user ? hasPermission(user.role, permission) : false);

  return { user, activeBranchId, accessToken, setActiveBranch, logout, can, isAuthenticated: !!user && !!accessToken };
}
