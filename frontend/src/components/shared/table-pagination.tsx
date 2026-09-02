"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const DEFAULT_PAGE_SIZE = 10;

export function paginate<T>(items: T[], page: number, pageSize: number = DEFAULT_PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/**
 * Resets `page` back to 1 whenever `filterKey` changes (e.g. a search query
 * or filter select). Adjusts state during render per React's guidance
 * instead of setState-in-an-effect, which avoids an extra render pass.
 */
export function usePageReset(filterKey: string, setPage: (page: number) => void) {
  const [prevKey, setPrevKey] = useState(filterKey);
  if (filterKey !== prevKey) {
    setPrevKey(filterKey);
    setPage(1);
  }
}

export function TablePagination({
  page,
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  if (pageCount <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);

  const pages: (number | "ellipsis")[] = [];
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== "ellipsis") pages.push("ellipsis");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{start}–{end}</span> of{" "}
        <span className="font-medium text-foreground">{totalItems}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e${i}`} className="px-1.5 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "outline" : "ghost"}
              size="icon"
              className="h-8 w-8 text-sm"
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
