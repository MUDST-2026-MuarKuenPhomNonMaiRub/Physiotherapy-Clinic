"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Google sends the browser back to /calendar?google=connected|error after
 * the consent screen. This turns that into a message and tidies the address
 * bar, so a refresh does not repeat it.
 */
export function GoogleReturnNotice() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("google");
    if (!outcome) return;
    if (outcome === "connected") {
      const queued = Number(params.get("queued") ?? 0);
      toast.success(
        queued > 0
          ? `Google Calendar connected — ${queued} upcoming appointment(s) are being added to it`
          : "Google Calendar connected — new bookings will appear in it"
      );
    } else {
      toast.error(`Google Calendar was not connected: ${params.get("message") ?? "unknown error"}`);
    }
    params.delete("google");
    params.delete("queued");
    params.delete("message");
    const rest = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
  }, []);
  return null;
}
