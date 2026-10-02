"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CornerDownLeft, Loader2, Package, Receipt, Search, UserRound } from "lucide-react";
import * as api from "@/lib/api/clinic-api";
import { useSession } from "@/lib/auth/use-session";
import { useBranchScope } from "@/lib/auth/use-branch-scope";
import { useClinicStore } from "@/lib/store/clinic-store";
import { getPatientFullNameTh, remainingSessions } from "@/lib/domain";
import { formatCurrency, formatDate, formatPhone } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Patient, PatientCourse } from "@/types";

/** How long typing must pause before the search goes to the server. */
const SEARCH_DEBOUNCE_MS = 250;
/** Shorter text matches too much of the patient list to be worth a request. */
const MIN_QUERY = 2;
const PER_GROUP = 5;

type Group = "Patients" | "Appointments" | "Receipts" | "Courses";

interface Result {
  id: string;
  group: Group;
  label: string;
  detail: string;
  icon: ReactNode;
  href: string;
}

/** Booking and receipt numbers match with or without their dashes. */
function normalise(value: string) {
  return value.toLowerCase().replace(/[\s-]/g, "");
}

/**
 * The header search finds anything by what staff have in hand — a patient's
 * HN, name or phone, a booking number, a receipt number — and opens it
 * directly. Each list page keeps its own search for narrowing that page.
 */
export function GlobalSearch() {
  const router = useRouter();
  const { user, can, activeBranchId } = useSession();
  const { isAccessible } = useBranchScope();
  const appointments = useClinicStore((s) => s.appointments);
  const transactions = useClinicStore((s) => s.transactions);
  const patients = useClinicStore((s) => s.patients);
  const courseTemplates = useClinicStore((s) => s.courseTemplates);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Server results are kept with the text they answer, so a slow reply to an
  // older query is never shown under a newer one.
  const [remote, setRemote] = useState<{ query: string; patients: Patient[]; courses: PatientCourse[] }>({
    query: "",
    patients: [],
    courses: [],
  });
  const box = useRef<HTMLDivElement>(null);

  const canPatients = can("patient.view");
  const canCourses = can("course.view");
  const canAppointments = can("appointment.view");
  const canReceipts = can("transaction.view");
  const trimmed = query.trim();
  const ready = trimmed.length >= MIN_QUERY;
  // Same scope as the patient list: an administrator searches every branch,
  // everyone else the branch they are working in.
  const searchBranchId = user?.role === "ADMIN" ? undefined : (activeBranchId ?? user?.branchIds[0]);

  useEffect(() => {
    if (!ready || (!canPatients && !canCourses)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      Promise.all([
        canPatients ? api.listPatientsPage(0, PER_GROUP, trimmed, searchBranchId).then((p) => p.items) : [],
        canCourses ? api.listPatientCoursesPage(0, PER_GROUP, trimmed, searchBranchId).then((p) => p.items) : [],
      ])
        .then(([foundPatients, foundCourses]) => {
          if (!cancelled) setRemote({ query: trimmed, patients: foundPatients, courses: foundCourses });
        })
        .catch(() => {
          if (!cancelled) setRemote({ query: trimmed, patients: [], courses: [] });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, trimmed, canPatients, canCourses, searchBranchId]);

  // Close when focus or a click lands anywhere outside the search.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const searching = ready && (canPatients || canCourses) && remote.query !== trimmed;

  const results = useMemo<Result[]>(() => {
    if (!ready) return [];
    const nameOf = (patientId: string) => {
      const patient = patients.find((p) => p.id === patientId);
      return patient ? getPatientFullNameTh(patient) : "";
    };
    const needle = normalise(trimmed);
    const items: Result[] = [];

    if (remote.query === trimmed) {
      for (const p of remote.patients) {
        items.push({
          id: `patient-${p.id}`,
          group: "Patients",
          label: getPatientFullNameTh(p),
          detail: `${p.hn} · ${formatPhone(p.phone)}`,
          icon: <UserRound className="h-4 w-4" />,
          href: `/patients/${p.id}`,
        });
      }
    }

    if (canAppointments) {
      appointments
        .filter((a) => a.appointmentNo && isAccessible(a.branchId) && normalise(a.appointmentNo).includes(needle))
        .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`))
        .slice(0, PER_GROUP)
        .forEach((a) =>
          items.push({
            id: `appointment-${a.id}`,
            group: "Appointments",
            label: a.appointmentNo!,
            detail: [formatDate(a.date), `${a.startTime}–${a.endTime}`, nameOf(a.patientId)].filter(Boolean).join(" · "),
            icon: <CalendarCheck className="h-4 w-4" />,
            href: `/appointments/${a.id}`,
          })
        );
    }

    if (canReceipts) {
      transactions
        .filter((t) => isAccessible(t.branchId) && normalise(t.transactionNo).includes(needle))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, PER_GROUP)
        .forEach((t) =>
          items.push({
            id: `receipt-${t.id}`,
            group: "Receipts",
            label: t.transactionNo,
            detail: [formatDate(t.date), formatCurrency(t.total), nameOf(t.patientId), t.status === "VOID" ? "VOID" : ""]
              .filter(Boolean)
              .join(" · "),
            icon: <Receipt className="h-4 w-4" />,
            href: `/transactions/${t.id}`,
          })
        );
    }

    if (remote.query === trimmed) {
      for (const pc of remote.courses) {
        const template = courseTemplates.find((c) => c.id === pc.courseId);
        items.push({
          id: `course-${pc.id}-${pc.patientId}`,
          group: "Courses",
          label: template?.name ?? "Course",
          detail: [nameOf(pc.patientId), `${remainingSessions(pc)} sessions left`].filter(Boolean).join(" · "),
          icon: <Package className="h-4 w-4" />,
          href: `/courses/${pc.id}`,
        });
      }
    }
    return items;
  }, [ready, trimmed, remote, canAppointments, canReceipts, appointments, transactions, patients, courseTemplates, isAccessible]);

  if (!user || (!canPatients && !canAppointments && !canReceipts && !canCourses)) return null;

  const current = Math.min(active, Math.max(results.length - 1, 0));

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!results.length) {
      // Nothing to pick yet: Enter still finds the text in the patient list.
      if (event.key === "Enter" && trimmed && canPatients) {
        event.preventDefault();
        go(`/patients?q=${encodeURIComponent(trimmed)}`);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[current].href);
    }
  };

  const showPanel = open && ready;

  return (
    <div ref={box} className="relative hidden w-56 shrink-0 xl:block 2xl:w-72">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search patient, AP or receipt no."
        className="h-9 pl-8 text-sm"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        aria-activedescendant={showPanel && results[current] ? `search-${results[current].id}` : undefined}
        aria-label="Search patients, appointments, receipts and courses"
      />

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 max-h-[min(30rem,70vh)] w-[30rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
        >
          {results.length === 0 ? (
            <p className="flex items-center justify-center gap-2 px-3 py-6 text-center text-sm text-muted-foreground">
              {searching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </>
              ) : (
                "Nothing found. Try an HN, a phone number, or an AP or receipt number."
              )}
            </p>
          ) : (
            results.map((result, index) => (
              <div key={result.id}>
                {result.group !== results[index - 1]?.group && (
                  <p className="flex items-center gap-2 px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {result.group}
                    {searching && index === 0 && <Loader2 className="h-3 w-3 animate-spin" />}
                  </p>
                )}
                <div
                  id={`search-${result.id}`}
                  role="option"
                  aria-selected={index === current}
                  onMouseMove={() => index !== current && setActive(index)}
                  onClick={() => go(result.href)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2",
                    index === current && "bg-primary/10"
                  )}
                >
                  <span className={cn("shrink-0", index === current ? "text-primary" : "text-muted-foreground")}>
                    {result.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{result.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{result.detail}</span>
                  </span>
                  {index === current && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
