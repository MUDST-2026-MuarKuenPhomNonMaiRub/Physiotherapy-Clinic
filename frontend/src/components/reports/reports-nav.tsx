"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth/use-session";
import { navigationByRole } from "@/lib/permissions/navigation";
import { cn } from "@/lib/utils";

/**
 * The tabs mirror the sidebar's Report group, so a report the role cannot open
 * is not offered here either.
 */
export function ReportsNav() {
  const pathname = usePathname();
  const { user } = useSession();
  if (!user) return null;

  const items =
    navigationByRole[user.role].find((group) => group.title === "Report")?.items ?? [];

  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname === item.href ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
            pathname === item.href
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
