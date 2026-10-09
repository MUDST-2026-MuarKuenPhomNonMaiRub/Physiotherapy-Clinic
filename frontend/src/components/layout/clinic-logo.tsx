"use client";

import { useId } from "react";

/**
 * LA BALANCE mark — a figure balanced on a disc. Drawn as a knock-out mask so
 * the single `currentColor` fill works on the dark sidebar and on light panels
 * alike, with the figure showing whatever is behind it.
 *
 * The mask id must be unique per instance: the responsive layouts render two
 * copies (one inside a `hidden` branch), and a shared id resolves to the hidden
 * one — which paints the mark as a plain square.
 */
export function ClinicLogo({ className }: { className?: string }) {
  const maskId = useId();
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="LA BALANCE">
      <defs>
        <mask id={maskId}>
          <rect width="40" height="40" fill="black" />
          <circle cx="20" cy="20" r="19" fill="white" />
          <circle cx="20" cy="10.5" r="3.4" fill="black" />
          <path
            d="M11 16.8c0-1 .8-1.8 1.8-1.8h14.4c1 0 1.8.8 1.8 1.8s-.8 1.8-1.8 1.8h-4.9l3.6 10.2a1.9 1.9 0 0 1-3.6 1.2L20 22.7l-2.3 7.3a1.9 1.9 0 0 1-3.6-1.2l3.6-10.2h-4.9c-1 0-1.8-.8-1.8-1.8Z"
            fill="black"
          />
        </mask>
      </defs>
      <rect width="40" height="40" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}
