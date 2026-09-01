"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, Plus, Search, ShoppingCart, Ticket, UserRound } from "lucide-react";
import type { Patient } from "@/types";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { useBranchScope } from "@/lib/auth/use-branch-scope";
import { getPatientFullNameEn, getPatientFullNameTh, searchPatients } from "@/lib/mock-data/patients";
import { remainingSessions } from "@/lib/mock-data/course-data";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TablePagination, paginate, usePageReset } from "@/components/shared/table-pagination";
import { BranchFilterSelect } from "@/components/shared/branch-filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

function CourseQuickGlance({ patientId }: { patientId: string }) {
  const patientCourses = useClinicStore((s) => s.patientCourses);
  const courseTemplates = useClinicStore((s) => s.courseTemplates);
  const mine = patientCourses.filter((pc) => pc.patientId === patientId);

  if (mine.length === 0) {
    return <span className="text-xs text-muted-foreground">No courses</span>;
  }

  const activeCount = mine.filter((pc) => pc.status === "ACTIVE").length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
        >
          <Ticket className="h-3.5 w-3.5" />
          {activeCount} active
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <PopoverHeader>
          <PopoverTitle>Course Balance</PopoverTitle>
        </PopoverHeader>
        <div className="space-y-2.5">
          {mine.map((pc) => {
            const tmpl = courseTemplates.find((c) => c.id === pc.courseId);
            const purchased = pc.purchased + pc.bonus;
            const remaining = remainingSessions(pc);
            const pct = purchased > 0 ? Math.round((remaining / purchased) * 100) : 0;
            return (
              <div key={pc.id} className="rounded-lg border border-border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{tmpl?.name ?? "Course"}</p>
                  <Badge
                    variant="outline"
                    className={pc.status === "ACTIVE" ? "border-success/20 bg-success/10 text-success" : "font-normal"}
                  >
                    {pc.status === "ACTIVE" ? "Active" : pc.status === "EXPIRED" ? "Expired" : "Used Up"}
                  </Badge>
                </div>
                <Progress value={pct} className="mt-2 h-1.5" />
                <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                  <span>Purchased {purchased}</span>
                  <span>Used {pc.used}</span>
                  <span className="font-medium text-foreground">{remaining} left</span>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PatientsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useSession();
  const { isAccessible } = useBranchScope();
  const patients = useClinicStore((s) => s.patients);
  const branches = useClinicStore((s) => s.branches);
  const appointments = useClinicStore((s) => s.appointments);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const results = useMemo(() => {
    const filtered = searchPatients(query, patients).filter((p) =>
      branchFilter === "ALL" ? isAccessible(p.registrationBranchId) : p.registrationBranchId === branchFilter
    );
    return filtered
      .map((p) => {
        const visits = appointments
          .filter((a) => a.patientId === p.id && a.status === "COMPLETED")
          .sort((a, b) => `${b.date}`.localeCompare(`${a.date}`));
        return { patient: p, latestVisit: visits[0]?.date };
      })
      .sort((a, b) => b.patient.createdAt.localeCompare(a.patient.createdAt));
  }, [query, patients, appointments, branchFilter, isAccessible]);

  usePageReset(`${query}|${branchFilter}`, setPage);

  const pageResults = paginate(results, page);

  return (
    <>
      <PageHeader
        title="Patients"
        description={`${patients.length} registered patients`}
        actions={
          can("patient.create") ? (
            <Button asChild>
              <Link href="/patients/new">
                <Plus className="h-4 w-4" />
                Register Patient
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by HN, name, phone, national ID..."
            className="pl-9"
          />
        </div>
        <BranchFilterSelect value={branchFilter} onValueChange={setBranchFilter} className="w-44" />
        <p className="text-sm text-muted-foreground">{results.length} results</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {results.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="No patients found"
            description="Try a different search term, or register a new patient."
            action={
              can("patient.create") ? (
                <Button asChild variant="outline">
                  <Link href="/patients/new">
                    <Plus className="h-4 w-4" /> Register Patient
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3">HN</TableHead>
                  <TableHead className="py-3">Patient</TableHead>
                  <TableHead className="py-3">Gender</TableHead>
                  <TableHead className="py-3">Phone</TableHead>
                  <TableHead className="py-3">Customer Group</TableHead>
                  <TableHead className="py-3">Registration Branch</TableHead>
                  <TableHead className="py-3">Courses</TableHead>
                  <TableHead className="py-3">Latest Visit</TableHead>
                  <TableHead className="py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageResults.map(({ patient: p, latestVisit }) => {
                  const branch = branches.find((b) => b.id === p.registrationBranchId);
                  return (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/patients/${p.id}`)}
                    >
                      <TableCell className="py-3.5">
                        <span className="rounded-md bg-primary/5 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                          {p.hn}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor(p.id)}`}
                          >
                            {initials(p)}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-foreground hover:underline">{getPatientFullNameTh(p)}</p>
                            <p className="text-xs text-muted-foreground">{getPatientFullNameEn(p)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Badge variant="outline" className="font-normal">
                          {p.gender === "MALE" ? "Male" : p.gender === "FEMALE" ? "Female" : "Other"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-muted-foreground">{p.phone}</TableCell>
                      <TableCell className="py-3.5 text-sm text-muted-foreground">{p.customerGroup}</TableCell>
                      <TableCell className="py-3.5 text-sm text-muted-foreground">{branch?.name}</TableCell>
                      <TableCell className="py-3.5" onClick={(e) => e.stopPropagation()}>
                        <CourseQuickGlance patientId={p.id} />
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-muted-foreground">
                        {latestVisit ? formatDate(latestVisit) : "—"}
                      </TableCell>
                      <TableCell className="py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {can("appointment.create") && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                                  <Link href={`/appointments/new?patientId=${p.id}`}>
                                    <CalendarPlus className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>New Appointment</TooltipContent>
                            </Tooltip>
                          )}
                          {can("checkout.create") && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                                  <Link href={`/checkout?patientId=${p.id}`}>
                                    <ShoppingCart className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Checkout</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={page} totalItems={results.length} onPageChange={setPage} />
          </>
        )}
      </div>
    </>
  );
}

export default function PatientsPage() {
  return (
    <Suspense>
      <PatientsPageContent />
    </Suspense>
  );
}
