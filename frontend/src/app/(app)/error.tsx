"use client";

import { useEffect } from "react";
import { ClinicLogo } from "@/components/layout/clinic-logo";
import { Button } from "@/components/ui/button";

/**
 * Without a boundary here, a page that throws while rendering takes the whole
 * tree down with it and the browser is left showing nothing at all — the blank
 * screen carries no hint of what went wrong, and reloading is the only move
 * anyone can make. This turns that into a message, a retry, and an error in the
 * console worth reading.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page failed to render:", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <ClinicLogo className="h-11 w-11 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">This page could not be displayed</p>
          <p className="text-sm text-muted-foreground">
            {error.message || "Something went wrong while loading this screen."}
          </p>
          {error.digest && (
            <p className="pt-1 font-mono text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          )}
        </div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
