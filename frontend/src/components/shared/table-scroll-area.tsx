"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function TableScrollArea({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function update() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }
    update();
    el.addEventListener("scroll", update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      <div ref={ref} className={cn("overflow-x-auto", className)}>
        {children}
      </div>
      {canScrollLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-card to-transparent" />
      )}
      {canScrollRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent" />
      )}
    </div>
  );
}
