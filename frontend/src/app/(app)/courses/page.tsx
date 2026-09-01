"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Ticket } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useBranchScope } from "@/lib/auth/use-branch-scope";
import { getPatientFullNameTh, searchPatients } from "@/lib/mock-data/patients";
import { formatDate } from "@/lib/format";
import { remainingSessions } from "@/lib/mock-data/course-data";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { TablePagination, paginate, usePageReset } from "@/components/shared/table-pagination";
import { BranchFilterSelect } from "@/components/shared/branch-filter-select";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PatientCourseStatus } from "@/types";

export default function CoursesPage() {
  const router = useRouter();
  const { isAccessible } = useBranchScope();
  const patients = useClinicStore((s) => s.patients);
  const patientCourses = useClinicStore((s) => s.patientCourses);
  const courseTemplates = useClinicStore((s) => s.courseTemplates);

  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<PatientCourseStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);

  const matchingPatientIds = useMemo(
    () => (query ? new Set(searchPatients(query, patients).map((p) => p.id)) : null),
    [query, patients]
  );

  const rows = useMemo(() => {
    return patientCourses
      .filter((pc) => !matchingPatientIds || matchingPatientIds.has(pc.patientId))
      .filter((pc) => (branchFilter === "ALL" ? isAccessible(pc.branchId) : pc.branchId === branchFilter))
      .filter((pc) => courseFilter === "ALL" || pc.courseId === courseFilter)
      .filter((pc) => statusFilter === "ALL" || pc.status === statusFilter)
      .map((pc) => ({
        pc,
        patient: patients.find((p) => p.id === pc.patientId),
        template: courseTemplates.find((c) => c.id === pc.courseId),
      }))
      .sort((a, b) => b.pc.purchaseDate.localeCompare(a.pc.purchaseDate));
  }, [patientCourses, matchingPatientIds, branchFilter, courseFilter, statusFilter, patients, courseTemplates, isAccessible]);

  usePageReset(`${query}|${branchFilter}|${courseFilter}|${statusFilter}`, setPage);

  const pageRows = paginate(rows, page);

  return (
    <>
      <PageHeader title="Patient Courses" description="Track course balances, usage and expiry across all patients" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search patient or HN..." className="pl-9" />
        </div>
        <BranchFilterSelect value={branchFilter} onValueChange={setBranchFilter} className="w-44" />
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Course" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Courses</SelectItem>
            {courseTemplates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PatientCourseStatus | "ALL")}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="USED_UP">Used Up</SelectItem>
          </SelectContent>
        </Select>
        <p className="ml-auto text-sm text-muted-foreground">{rows.length} courses</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Ticket} title="No courses found" description="Try adjusting your search or filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-center">Purchased</TableHead>
                  <TableHead className="text-center">Bonus</TableHead>
                  <TableHead className="text-center">Used</TableHead>
                  <TableHead className="text-center">Balance</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map(({ pc, patient, template }) => {
                  const rem = remainingSessions(pc);
                  const purchasedTotal = pc.purchased + pc.transferIn;
                  const total = purchasedTotal + pc.bonus;
                  const pct = total > 0 ? Math.max(0, Math.min(100, (rem / total) * 100)) : 0;
                  const barColor = pc.status !== "ACTIVE" ? "bg-muted-foreground/40" : pct <= 20 ? "bg-destructive" : pct <= 50 ? "bg-warning" : "bg-success";
                  return (
                    <TableRow key={pc.id} className="cursor-pointer" onClick={() => router.push(`/courses/${pc.id}`)}>
                      <TableCell>
                        <p className="font-medium text-foreground">{patient ? getPatientFullNameTh(patient) : "—"}</p>
                        <p className="font-mono text-xs text-muted-foreground">{patient?.hn}</p>
                      </TableCell>
                      <TableCell>{template?.name}</TableCell>
                      <TableCell className="text-center">{purchasedTotal}</TableCell>
                      <TableCell className="text-center">{pc.bonus}</TableCell>
                      <TableCell className="text-center">{pc.used}</TableCell>
                      <TableCell>
                        <div className="mx-auto w-24">
                          <p className="text-center text-sm font-semibold text-foreground">{rem} <span className="font-normal text-muted-foreground">/ {total}</span></p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(pc.expiryDate)}</TableCell>
                      <TableCell><StatusBadge status={pc.status} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={page} totalItems={rows.length} onPageChange={setPage} />
        </div>
      )}
    </>
  );
}
