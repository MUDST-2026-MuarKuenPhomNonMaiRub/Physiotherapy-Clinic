"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Check, Clock, Search } from "lucide-react";
import type { Service } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const USAGE_KEY = "clinic-service-selection-counts";
function subscribeUsage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("service-usage-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("service-usage-change", callback); };
}
function usageSnapshot() {
  try { return window.localStorage.getItem(USAGE_KEY) ?? "{}"; } catch { return "{}"; }
}
function serverUsageSnapshot() { return "{}"; }

/** Search-first selector which remembers the services used at this browser. */
export function ServicePicker({
  services,
  value,
  onValueChange,
  placeholder = "Select service",
  className,
  inline = false,
}: {
  services: Service[];
  value: string;
  onValueChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const usageData = useSyncExternalStore(subscribeUsage, usageSnapshot, serverUsageSnapshot);
  const usage = readUsage(usageData);

  function readUsage(data = usageSnapshot()) {
    try {
      const saved: unknown = JSON.parse(data);
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
      return Object.fromEntries(Object.entries(saved).filter(([, count]) => typeof count === "number" && Number.isFinite(count) && count > 0)) as Record<string, number>;
    } catch { return {}; }
  }
  const selected = services.find((service) => service.id === value);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return services.filter((service) =>
      (category === "ALL" || service.type === category) &&
      (!normalized || `${service.code} ${service.name}`.toLocaleLowerCase().includes(normalized))
    );
  }, [query, services, category]);
  const frequent = services.filter((service) => usage[service.id] > 0).sort((a, b) => usage[b.id] - usage[a.id]).slice(0, 6);

  function choose(id: string) {
    const current = readUsage();
    const next = { ...current, [id]: (current[id] ?? 0) + 1 };
    try { window.localStorage.setItem(USAGE_KEY, JSON.stringify(next)); window.dispatchEvent(new Event("service-usage-change")); } catch {}
    onValueChange(id);
    setOpen(false);
    setQuery("");
  }

  const content = (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Search services" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type service name or code..." className="pl-9" />
      </div>
      <div className="my-3 flex flex-wrap gap-2" aria-label="Service categories">
        {[["ALL", "All services"], ["ASSESSMENT", "Assessment"], ["SINGLE_VISIT", "Treatment"]].map(([id, label]) => (
          <Button key={id} type="button" size="sm" variant={category === id ? "default" : "outline"} aria-pressed={category === id} onClick={() => setCategory(id)}>{label}</Button>
        ))}
      </div>
      {!query && category === "ALL" && frequent.length > 0 && <PickerGroup label="Frequently selected on this device" services={frequent} selectedId={value} onChoose={choose} />}
      <PickerGroup label={query ? "Results" : "Services"} services={matches} selectedId={value} onChoose={choose} emptyText="No matching service" />
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{matches.length} services</p>
    </div>
  );

  if (inline) return <div className={className}>{content}</div>;

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={`w-full justify-between font-normal ${className ?? ""}`}>
          <span className="truncate">{selected ? `${selected.code ? `${selected.code} · ` : ""}${selected.name}` : placeholder}</span>
          <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-3">{content}</PopoverContent>
    </Popover>
  );
}

function PickerGroup({ label, services, selectedId, onChoose, emptyText }: { label: string; services: Service[]; selectedId: string; onChoose: (id: string) => void; emptyText?: string }) {
  return <div className="mt-2"><p className="px-1 py-1 text-xs font-medium text-muted-foreground">{label}</p>{services.length ? <div className="max-h-72 overflow-y-auto">{services.map((service) => <button key={service.id} type="button" onClick={() => onChoose(service.id)} aria-pressed={selectedId === service.id} className={`flex w-full items-center gap-2 rounded-md px-3 py-3 text-left hover:bg-muted focus-visible:outline-ring ${selectedId === service.id ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : ""}`}><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{service.name}</span><span className="block text-xs text-muted-foreground">{service.code || "—"} · {service.duration} min</span></span>{selectedId === service.id ? <Check className="h-4 w-4 text-primary" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}</button>)}</div> : emptyText ? <p className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</p> : null}</div>;
}
