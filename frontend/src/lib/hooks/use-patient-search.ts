"use client";

import { useEffect, useState } from "react";
import type { Patient } from "@/types";
import { listPatientsPage } from "@/lib/api/clinic-api";

/** Search the complete patient table through the API, rather than the local snapshot. */
export function usePatientSearch(query: string, branchId?: string | null, limit = 6) {
  const [items, setItems] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void listPatientsPage(0, limit, trimmed, branchId).then((response) => {
        if (!cancelled) setItems(response.items);
      }).catch(() => {
        if (!cancelled) setItems([]);
      }).finally(() => {
        if (!cancelled) setLoading(false);
      });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [branchId, limit, query]);

  return { items, loading };
}
