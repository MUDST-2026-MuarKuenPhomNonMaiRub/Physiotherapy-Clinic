"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoading } from "@/components/shared/page-loading";

/**
 * Stands in front of a detail page whose record is looked up in the
 * operational lists (patients, courses, visits, transactions). Those arrive
 * after the shell is up, so a page opened from a link or a refresh finds
 * nothing at first. Calling notFound() then would stick: the 404 replaces the
 * page and stays even once the record arrives.
 *
 * Until the lists have settled this shows the loading skeleton, and only a
 * record still missing after that is reported as not found — in the page, so
 * it clears by itself if a later load brings the record in.
 */
export function RecordGate({
  found,
  title,
  backHref,
  backLabel,
  children,
}: {
  found: boolean;
  title: string;
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  const settling = useClinicStore((s) => s.loading || s.operationalLoading || !s.operationalLoaded);

  if (found) return children;
  if (settling) return <PageLoading />;
  return (
    <EmptyState
      icon={SearchX}
      title={title}
      description="It may have been removed, or it belongs to a branch you cannot see."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      }
    />
  );
}
