"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  findActiveHref,
  navigationByRole,
  pinnedByRole,
  type NavItem,
} from "@/lib/permissions/navigation";
import type { Role } from "@/types";
import { NavIcon } from "@/components/layout/nav-icon";
import { cn } from "@/lib/utils";

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
          : "text-white/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function NavContent({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeHref = findActiveHref(role, pathname);
  const pinned = pinnedByRole[role];
  const groups = navigationByRole[role];

  return (
    <nav className="flex-1 overflow-y-auto px-4 py-4">
      <NavLink item={pinned} active={activeHref === pinned.href} onNavigate={onNavigate} />

      {groups.map((group) => (
        <div key={group.title} className="mt-5 first:mt-6">
          {group.title && (
            <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-sidebar-section">
              {group.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} active={activeHref === item.href} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
