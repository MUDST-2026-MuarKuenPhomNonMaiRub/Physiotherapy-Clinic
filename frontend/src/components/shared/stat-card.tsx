import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function Sparkline({ data, tone }: { data: number[]; tone: string }) {
  if (data.length < 2) return null;
  const w = 100;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;
  const gradientId = `spark-${tone}`;
  const toneVar: Record<string, string> = {
    primary: "var(--color-primary)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    info: "var(--color-info)",
    neutral: "var(--color-muted-foreground)",
  };
  const strokeColor = toneVar[tone] ?? toneVar.primary;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-7 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  sparkline,
  tone = "primary",
  className,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: { value: string; positive: boolean };
  sparkline?: number[];
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
        "rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md",
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
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {trend && (
          <span className={cn("text-xs font-medium", trend.positive ? "text-success" : "text-destructive")}>
            {trend.positive ? "▲" : "▼"} {trend.value}
          </span>
        )}
      </div>
      {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} tone={tone} />}
    </div>
  );
}
