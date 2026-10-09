"use client";

import { useId, useState, type PointerEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** One period on a card's sparkline: its name, its figure, and how to show that figure. */
export interface SparklinePoint {
  label: string;
  value: number;
  display: string;
}

const toneVar: Record<string, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  info: "var(--color-info)",
  neutral: "var(--color-muted-foreground)",
};

/**
 * The line stretches to the card's width, so its markers are HTML dots laid
 * over it by percentage — an SVG circle would be squashed into an ellipse.
 * The last point is the card's own figure and carries a dot; pointing at the
 * line names the period under the pointer in the caption row instead.
 */
function Sparkline({ points, tone, caption }: { points: SparklinePoint[]; tone: string; caption?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (points.length < 2) return null;

  const w = 100;
  const h = 28;
  const pad = 3; // keeps the line and the dot clear of the top and bottom edges
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: pad + (1 - (v - min) / range) * (h - pad * 2),
  }));
  const linePath = `M${coords.map((c) => `${c.x},${c.y}`).join(" L")}`;
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;
  const strokeColor = toneVar[tone] ?? toneVar.primary;
  const marked = active ?? points.length - 1;
  const dot = coords[marked];

  function pick(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    setActive(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))));
  }

  return (
    <div className="mt-auto pt-2">
      <div
        className="relative h-7 w-full cursor-crosshair touch-none"
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {active !== null && (
          <span
            className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-border"
            style={{ left: `${dot.x}%` }}
            aria-hidden="true"
          />
        )}
        <span
          className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
          style={{ left: `${dot.x}%`, top: `${(dot.y / h) * 100}%`, backgroundColor: strokeColor }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-1 h-4 truncate text-[11px] tabular-nums text-muted-foreground">
        {active !== null ? `${points[active].label}: ${points[active].display}` : caption}
      </p>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  sparkline,
  sparklineCaption,
  tone = "primary",
  className,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  /** Change against a previous period; `label` names that period ("vs previous month"). */
  trend?: { value: string; direction: "up" | "down" | "flat"; label?: string };
  /** Oldest first; the last point is the period `value` shows. */
  sparkline?: SparklinePoint[];
  /** Names the span the sparkline covers ("Last 12 months"). */
  sparklineCaption?: string;
  tone?: "primary" | "success" | "warning" | "info" | "neutral";
  className?: string;
}) {
  const toneBg: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    info: "bg-info/10 text-info",
    neutral: "bg-muted text-muted-foreground",
  };
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneBg[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {trend && (
        <p className="mt-1 flex min-w-0 items-baseline gap-x-1.5 text-xs">
          <span
            className={cn(
              "shrink-0 font-medium tabular-nums",
              trend.direction === "up" && "text-success",
              trend.direction === "down" && "text-destructive",
              trend.direction === "flat" && "text-muted-foreground"
            )}
          >
            {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "–"} {trend.value}
          </span>
          {trend.label && (
            <span className="truncate text-muted-foreground" title={trend.label}>
              {trend.label}
            </span>
          )}
        </p>
      )}
      {sparkline && sparkline.length > 1 && <Sparkline points={sparkline} tone={tone} caption={sparklineCaption} />}
    </div>
  );
}
