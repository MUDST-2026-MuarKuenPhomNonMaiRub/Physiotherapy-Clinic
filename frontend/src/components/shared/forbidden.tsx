import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Forbidden({ homeHref = "/" }: { homeHref?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-7 w-7 text-destructive" />
      </div>
      <p className="text-lg font-semibold text-foreground">403 — Access Denied</p>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        You don&apos;t have permission to access this page.
      </p>
      <Button asChild className="mt-6">
        <Link href={homeHref}>Back to Home</Link>
      </Button>
    </div>
  );
}
