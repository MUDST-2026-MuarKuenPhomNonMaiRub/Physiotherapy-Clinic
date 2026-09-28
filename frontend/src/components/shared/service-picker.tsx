"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Check, Search, Star } from "lucide-react";
import { useSession } from "@/lib/auth/use-session";
import { useLanguage } from "@/components/i18n/language-provider";
import type { Service } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const FAVORITES_EVENT = "clinic-service-favorites-change";
const temporaryFavorites = new Map<string, string>();
function subscribeFavorites(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(FAVORITES_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(FAVORITES_EVENT, callback);
  };
}
function readFavorites(key: string) {
  if (temporaryFavorites.has(key)) return temporaryFavorites.get(key)!;
  try { return window.localStorage.getItem(key) ?? "[]"; } catch { return "[]"; }
}
function parseFavorites(data: string): string[] {
  try {
    const ids: unknown = JSON.parse(data);
    return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === "string"))] : [];
  } catch { return []; }
}
function serverFavorites() { return "[]"; }

/** Stars save shortcuts without selecting a service or closing the picker. */
export function ServicePicker({
  services, value, onValueChange, placeholder = "Select service", className, inline = false,
}: {
  services: Service[];
  value: string;
  onValueChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  inline?: boolean;
}) {
  const { user } = useSession();
  const { t } = useLanguage();
  const storageKey = `clinic-service-favorites:${user?.id ?? "guest"}`;
  const saved = useSyncExternalStore(subscribeFavorites, () => readFavorites(storageKey), serverFavorites);
  const favoriteIds = useMemo(() => parseFavorites(saved), [saved]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("FAVORITES");
  const [storageWarning, setStorageWarning] = useState(false);
  const selected = services.find((service) => service.id === value);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const favoriteCount = services.filter((service) => favoriteIds.includes(service.id)).length;

  const visibleServices = useMemo(() => {
    const order = new Map(favoriteIds.map((id, index) => [id, index]));
    return services.filter((service) => {
      // Searching always reaches the complete supplied catalogue, including unstarred services.
      if (normalizedQuery) return `${service.code} ${service.name}`.toLocaleLowerCase().includes(normalizedQuery);
      if (category === "FAVORITES") return order.has(service.id);
      return category === "ALL" || service.type === category;
    }).sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
  }, [services, favoriteIds, normalizedQuery, category]);

  function toggleFavorite(id: string) {
    const current = parseFavorites(readFavorites(storageKey));
    const next = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current];
    const serialized = JSON.stringify(next);
    try {
      window.localStorage.setItem(storageKey, serialized);
      temporaryFavorites.delete(storageKey);
      setStorageWarning(false);
    } catch {
      temporaryFavorites.set(storageKey, serialized);
      setStorageWarning(true);
    }
    window.dispatchEvent(new Event(FAVORITES_EVENT));
  }

  function choose(id: string) {
    onValueChange(id);
    setOpen(false);
    setQuery("");
  }

  const content = (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Search services" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all services by name or code..." className="pl-9" />
      </div>
      <div className="my-3 flex flex-wrap gap-2" aria-label="Service categories">
        {[["FAVORITES", "Favorites"], ["ALL", "All services"], ["ASSESSMENT", "Assessment"], ["SINGLE_VISIT", "Treatment"]].map(([id, label]) => (
          <Button key={id} type="button" size="sm" variant={!normalizedQuery && category === id ? "default" : "outline"} aria-pressed={!normalizedQuery && category === id} onClick={() => { setCategory(id); setQuery(""); }}>
            {id === "FAVORITES" && <Star className="h-3.5 w-3.5" />}
            <span>{label}</span>{id === "FAVORITES" && <span className="text-xs tabular-nums">{favoriteCount}</span>}
          </Button>
        ))}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Star services to keep them in Favorites. Saved for your account on this browser.</p>
      {storageWarning && <p role="status" className="mb-3 text-xs text-amber-700 dark:text-amber-400">Favorites are available for this session only because browser storage is unavailable.</p>}
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{normalizedQuery ? "Results across all services" : category === "FAVORITES" ? "Your favorites · newest first" : "Services · favorites first"}</span>
        <span aria-live="polite">{visibleServices.length}</span>
      </div>
      {visibleServices.length > 0 ? (
        <div className="max-h-80 grid-cols-1 gap-2 overflow-y-auto p-1 sm:grid sm:grid-cols-2">
          {visibleServices.map((service) => {
            const isFavorite = favoriteIds.includes(service.id);
            const isSelected = value === service.id;
            return (
              <div key={service.id} className={`flex min-h-14 items-center gap-1 rounded-lg border ${isSelected ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted/50"}`}>
                <button type="button" onClick={() => choose(service.id)} aria-pressed={isSelected} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left focus-visible:outline-ring">
                  <span className="min-w-0 flex-1">
                    <span className="block line-clamp-2 break-words text-sm font-medium">{service.name}</span>
                    <span className="block text-xs text-muted-foreground">{service.code || "—"} · {service.duration} min</span>
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
                <Button type="button" variant="ghost" size="icon" aria-pressed={isFavorite} aria-label={`${t(isFavorite ? "Remove from favorites" : "Add to favorites")}: ${service.name}`} title={t(isFavorite ? "Remove from favorites" : "Add to favorites")} onClick={() => toggleFavorite(service.id)} className={`mr-0.5 h-8 w-8 shrink-0 ${isFavorite ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground"}`}>
                  <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-current" : ""}`} />
                </Button>
              </div>
            );
          })}
        </div>
      ) : category === "FAVORITES" && !normalizedQuery ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-7 text-center">
          <Star className="mx-auto mb-2 h-6 w-6 text-amber-500" />
          <p className="text-sm font-medium">No favorite services yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Search for a service and tap its star, or browse all services.</p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setCategory("ALL")}>Browse all services</Button>
        </div>
      ) : <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matching service</p>}
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
