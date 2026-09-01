"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/reports/revenue", label: "Revenue" },
  { href: "/reports/course-balance", label: "Course Balance" },
  { href: "/reports/staff-sales", label: "Staff Sales" },
  { href: "/reports/commission", label: "Commission" },
];

export function ReportsNav() {
  const pathname = usePathname();
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
