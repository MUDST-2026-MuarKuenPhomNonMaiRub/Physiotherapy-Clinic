"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, Plus, Search, ShoppingCart, UserRound, Loader2, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import type { Patient } from "@/types";
import { useSession } from "@/lib/auth/use-session";
import * as api from "@/lib/api/clinic-api";
import { getPatientFullNameTh } from "@/lib/domain";
import { formatDate, formatPhone, formatThaiNationalId } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { EmptyState } from "@/components/shared/empty-state";
import { TablePagination } from "@/components/shared/table-pagination";
import { BranchFilterSelect } from "@/components/shared/branch-filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const avatarPalette = ["bg-blue-600", "bg-emerald-600", "bg-teal-600", "bg-indigo-600", "bg-violet-600", "bg-rose-600"];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return avatarPalette[hash % avatarPalette.length];
}

function initials(p: Patient) {
  const a = p.firstNameEn?.[0] ?? p.firstNameTh?.[0] ?? "";
  const b = p.lastNameEn?.[0] ?? p.lastNameTh?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

function PatientsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, activeBranchId, can } = useSession();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [appliedSearch, setAppliedSearch] = useState(searchParams.get("q")?.trim() ?? "");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [items, setItems] = useState<Patient[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestBranchId = branchFilter === "ALL"
    ? user?.role === "ADMIN" ? undefined : activeBranchId ?? user?.branchIds[0]
    : branchFilter;

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listPatientsPage(page, pageSize, appliedSearch, requestBranchId);
      setItems(response.items);
      setTotalItems(response.totalItems);
      setTotalPages(response.totalPages);
      setHasNext(response.hasNext);
      setHasPrevious(response.hasPrevious);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load patients");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page, pageSize, requestBranchId]);

  // Debounce search so the browser calls the backend once the user pauses typing.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(query.trim());
      setPage(0);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  // The effect synchronizes the page view with the server-side page state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadPage(); }, [loadPage]);

  const results = items;

  return (
    <>
      <PageHeader title="Patients" description={`${totalItems} registered patients`} actions={can("patient.create") ? (
        <Button asChild><Link href="/patients/new"><Plus className="h-4 w-4" /> Register Patient</Link></Button>
      ) : undefined} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by HN, name, nickname or phone..." className="pl-9" />
        </div>
        <BranchFilterSelect value={branchFilter} onValueChange={(value) => { setBranchFilter(value); setPage(0); }} className="w-44" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            aria-label="Patients per page"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <p className="text-sm text-muted-foreground">Page {totalPages ? page + 1 : 0} of {totalPages}</p>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrevious || loading}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {error ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void loadPage()}><RotateCcw className="h-4 w-4" /> Retry</Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading patients…</div>
        ) : results.length === 0 ? (
          <EmptyState icon={UserRound} title="No patients found" description="Try a different search term, or register a new patient." action={can("patient.create") ? (
            <Button asChild variant="outline"><Link href="/patients/new"><Plus className="h-4 w-4" /> Register Patient</Link></Button>
          ) : undefined} />
        ) : (
          <>
            <ul className="divide-y divide-border md:hidden">
              {results.map((p) => (
                <li key={p.id} className="flex items-center gap-1 pr-2">
                  <Link href={`/patients/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 active:bg-muted/50">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor(p.id)}`}>{initials(p)}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{getPatientFullNameTh(p)}</p><p className="truncate text-xs text-muted-foreground"><span className="font-mono text-primary">{p.hn}</span>{p.nickname && ` · ${p.nickname}`}{` · ${formatPhone(p.phone)}`}</p></div>
                  </Link>
                  <div className="flex shrink-0 gap-0.5">
                    {can("appointment.create") && <Button asChild size="icon" variant="ghost" className="h-9 w-9" aria-label="New appointment"><Link href={`/appointments/new?patientId=${p.id}`}><CalendarPlus className="h-4 w-4" /></Link></Button>}
                    {can("checkout.create") && <Button asChild size="icon" variant="ghost" className="h-9 w-9" aria-label="Checkout"><Link href={`/checkout?patientId=${p.id}`}><ShoppingCart className="h-4 w-4" /></Link></Button>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <Table><TableHeader><TableRow><TableHead className="py-3">HN</TableHead><TableHead className="py-3">Name</TableHead><TableHead className="py-3">NickName</TableHead><TableHead className="py-3">ID CARD</TableHead><TableHead className="py-3">SEX</TableHead><TableHead className="py-3">Phone No.</TableHead><TableHead className="py-3">Group</TableHead><TableHead className="py-3">Date Created</TableHead><TableHead className="py-3 text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{results.map((p) => <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/patients/${p.id}`)}>
                  <TableCell className="py-3.5"><span className="rounded-md bg-primary/5 px-2 py-0.5 font-mono text-xs font-semibold text-primary">{p.hn}</span></TableCell>
                  <TableCell className="py-3.5"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor(p.id)}`}>{initials(p)}</span><p className="text-sm font-medium">{getPatientFullNameTh(p)}</p></div></TableCell>
                  <TableCell className="py-3.5 text-sm text-muted-foreground">{p.nickname || "—"}</TableCell><TableCell className="py-3.5 font-mono text-sm text-muted-foreground">{p.nationalId ? formatThaiNationalId(p.nationalId) : p.passport || "—"}</TableCell>
                  <TableCell className="py-3.5"><Badge variant="outline" className="font-normal">{p.gender === "MALE" ? "Male" : p.gender === "FEMALE" ? "Female" : "Other"}</Badge></TableCell><TableCell className="py-3.5 text-sm text-muted-foreground">{formatPhone(p.phone)}</TableCell><TableCell className="py-3.5 text-sm text-muted-foreground">{p.customerGroup || "—"}</TableCell><TableCell className="py-3.5 text-sm text-muted-foreground">{p.createdAt ? formatDate(p.createdAt) : "—"}</TableCell>
                  <TableCell className="py-3.5" onClick={(e) => e.stopPropagation()}><div className="flex justify-end gap-1">
                    {can("appointment.create") && <Tooltip><TooltipTrigger asChild><Button asChild size="icon" variant="ghost" className="h-8 w-8"><Link href={`/appointments/new?patientId=${p.id}`}><CalendarPlus className="h-4 w-4" /></Link></Button></TooltipTrigger><TooltipContent>New Appointment</TooltipContent></Tooltip>}
                    {can("checkout.create") && <Tooltip><TooltipTrigger asChild><Button asChild size="icon" variant="ghost" className="h-8 w-8"><Link href={`/checkout?patientId=${p.id}`}><ShoppingCart className="h-4 w-4" /></Link></Button></TooltipTrigger><TooltipContent>Checkout</TooltipContent></Tooltip>}
                  </div></TableCell>
                </TableRow>)}</TableBody></Table>
            </div>
            <TablePagination
              page={page + 1}
              pageSize={pageSize}
              totalItems={totalItems}
              hasNext={hasNext}
              hasPrevious={hasPrevious}
              onPageChange={(next) => setPage(next - 1)}
            />
          </>
        )}
      </div>
      {hasNext && <span className="sr-only">More patient pages available</span>}
      {hasPrevious && <span className="sr-only">Previous patient pages available</span>}
    </>
  );
}

export default function PatientsPage() {
  return <Suspense fallback={<PageLoading />}><PatientsPageContent /></Suspense>;
}
