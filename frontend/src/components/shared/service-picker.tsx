"use client";

import { useMemo, useState } from "react";
import { Check, Clock, Search } from "lucide-react";
import type { Service } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const RECENT_SERVICES_KEY = "clinic-recent-service-ids";

/** Search-first selector which remembers the services used at this browser. */
export function ServicePicker({
  services,
  value,
  onValueChange,
  placeholder = "Select service",
  className,
}: {
  services: Service[];
  value: string;
  onValueChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECENT_SERVICES_KEY) ?? "[]");
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
    } catch { return []; }
  });
  const selected = services.find((service) => service.id === value);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return services.filter((service) =>
      !normalized || `${service.code} ${service.name}`.toLocaleLowerCase().includes(normalized)
    );
  }, [query, services]);
  const frequent = recentIds.map((id) => services.find((service) => service.id === id)).filter(Boolean) as Service[];

  function choose(id: string) {
    const next = [id, ...recentIds.filter((recentId) => recentId !== id)].slice(0, 6);
    setRecentIds(next);
    try { window.localStorage.setItem(RECENT_SERVICES_KEY, JSON.stringify(next)); } catch {}
    onValueChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={`w-full justify-between font-normal ${className ?? ""}`}>
          <span className="truncate">{selected ? `${selected.code ? `${selected.code} · ` : ""}${selected.name}` : placeholder}</span>
          <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type service name or code..." className="pl-8" />
        </div>
        {!query && frequent.length > 0 && <PickerGroup label="Frequently used" services={frequent} selectedId={value} onChoose={choose} />}
        <PickerGroup label={query ? "Results" : "All services"} services={matches} selectedId={value} onChoose={choose} emptyText="No matching service" />
      </PopoverContent>
    </Popover>
  );
}

function PickerGroup({ label, services, selectedId, onChoose, emptyText }: { label: string; services: Service[]; selectedId: string; onChoose: (id: string) => void; emptyText?: string }) {
  return <div className="mt-2"><p className="px-1 py-1 text-xs font-medium text-muted-foreground">{label}</p>{services.length ? <div className="max-h-52 overflow-y-auto">{services.map((service) => <button key={service.id} type="button" onClick={() => onChoose(service.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{service.name}</span><span className="block text-xs text-muted-foreground">{service.code || "—"} · {service.duration} min</span></span>{selectedId === service.id ? <Check className="h-4 w-4 text-primary" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}</button>)}</div> : emptyText ? <p className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</p> : null}</div>;
}
