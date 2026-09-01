"use client";

import { useMemo, useState } from "react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { getPatientFullNameTh, searchPatients } from "@/lib/mock-data/patients";
import { formatDate } from "@/lib/format";
import { remainingSessions, TODAY } from "@/lib/mock-data/course-data";
import { PageHeader } from "@/components/shared/page-header";
import { ReportsNav } from "@/components/reports/reports-nav";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Ticket, Search } from "lucide-react";

export default function CourseBalanceReportPage() {
  const patients = useClinicStore((s) => s.patients);
  const patientCourses = useClinicStore((s) => s.patientCourses);
  const courseTemplates = useClinicStore((s) => s.courseTemplates);
  const [query, setQuery] = useState("");

  const matchingPatientIds = useMemo(
    () => (query ? new Set(searchPatients(query, patients).map((p) => p.id)) : null),
    [query, patients]
  );

  const rows = useMemo(
    () =>
      patientCourses
        .filter((pc) => !matchingPatientIds || matchingPatientIds.has(pc.patientId))
        .map((pc) => ({
          pc,
          patient: patients.find((p) => p.id === pc.patientId),
          template: courseTemplates.find((c) => c.id === pc.courseId),
        }))
        .sort((a, b) => b.pc.purchaseDate.localeCompare(a.pc.purchaseDate)),
    [patientCourses, matchingPatientIds, patients, courseTemplates]
  );

  const activeCourses = rows.filter(({ pc }) => pc.status === "ACTIVE");
  const totalRemaining = activeCourses.reduce((s, { pc }) => s + remainingSessions(pc), 0);
  const expiringSoonDate = new Date(`${TODAY}T00:00:00`);
  expiringSoonDate.setDate(expiringSoonDate.getDate() + 30);
  const expiringSoonStr = expiringSoonDate.toISOString().slice(0, 10);
  const expiringSoonCount = activeCourses.filter(({ pc }) => pc.expiryDate <= expiringSoonStr).length;

  return (
    <>
      <PageHeader title="Course Balance Report" description="Course purchase, usage and remaining balance across all patients" />
      <ReportsNav />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Active Courses" value={String(activeCourses.length)} icon={Ticket} tone="primary" />
        <StatCard label="Total Remaining Sessions" value={String(totalRemaining)} icon={Ticket} tone="success" />
        <StatCard label="Expiring Within 30 Days" value={String(expiringSoonCount)} icon={AlertTriangle} tone="warning" />
      </div>

      <div className="mb-4 relative w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search patient or HN..." className="pl-9" />
      </div>

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
                <TableHead className="text-center">Transfer</TableHead>
                <TableHead className="text-center">Remaining</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ pc, patient, template }) => (
                <TableRow key={pc.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{patient ? getPatientFullNameTh(patient) : "—"}</p>
                    <p className="font-mono text-xs text-muted-foreground">{patient?.hn}</p>
                  </TableCell>
                  <TableCell>{template?.name}</TableCell>
                  <TableCell className="text-center">{pc.purchased}</TableCell>
                  <TableCell className="text-center">{pc.bonus}</TableCell>
                  <TableCell className="text-center">{pc.used}</TableCell>
                  <TableCell className="text-center text-muted-foreground">+{pc.transferIn} / -{pc.transferOut}</TableCell>
                  <TableCell className="text-center font-semibold text-foreground">{remainingSessions(pc)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(pc.expiryDate)}</TableCell>
                  <TableCell><StatusBadge status={pc.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
