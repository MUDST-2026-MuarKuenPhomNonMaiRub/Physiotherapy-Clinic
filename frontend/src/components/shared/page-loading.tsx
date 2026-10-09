import { Skeleton } from "@/components/ui/skeleton";

/**
 * The stand-in for a page whose Suspense boundary has not resolved. A boundary
 * given no fallback renders nothing, which reads as a page that failed rather
 * than one still arriving.
 */
export function PageLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
