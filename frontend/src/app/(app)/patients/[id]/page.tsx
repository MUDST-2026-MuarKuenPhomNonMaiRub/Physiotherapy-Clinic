"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  Pencil,
  Phone,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { getPatientFullNameEn, getPatientFullNameTh } from "@/lib/domain";
import { calcAge, formatCurrency, formatDate } from "@/lib/format";
import { remainingSessions } from "@/lib/domain";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, Ticket, Receipt } from "lucide-react";

export default function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useSession();
  const patients = useClinicStore((s) => s.patients);
  const branches = useClinicStore((s) => s.branches);
  const staff = useClinicStore((s) => s.staff);
  const services = useClinicStore((s) => s.services);
  const courseTemplates = useClinicStore((s) => s.courseTemplates);
  const appointments = useClinicStore((s) => s.appointments);
  const transactions = useClinicStore((s) => s.transactions);
  const patientCourses = useClinicStore((s) => s.patientCourses);
  const paymentMethods = useClinicStore((s) => s.paymentMethods);

  const patient = patients.find((p) => p.id === id);

  const patientAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.patientId === id)
        .sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)),
    [appointments, id]
  );
  const patientTransactions = useMemo(
    () => transactions.filter((t) => t.patientId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, id]
  );
  const courses = useMemo(() => patientCourses.filter((c) => c.patientId === id), [patientCourses, id]);

  if (!patient) notFound();

  const branch = branches.find((b) => b.id === patient.registrationBranchId);
  const age = calcAge(patient.dob);

  return (
    <>
      <Link href="/patients" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Patients
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {patient.firstNameTh[0]}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{getPatientFullNameTh(patient)}</h1>
              <Badge variant="outline" className="font-mono text-xs">{patient.hn}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{getPatientFullNameEn(patient)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{patient.gender === "MALE" ? "Male" : patient.gender === "FEMALE" ? "Female" : "Other"} · {age} yrs</span>
              <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{patient.phone}</span>
              <span>{patient.customerGroup}</span>
              <span>Registered at {branch?.name}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {can("patient.edit") && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/patients/${patient.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" /> Edit Patient
              </Link>
            </Button>
          )}
          {can("appointment.create") && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/appointments/new?patientId=${patient.id}`}>
                <CalendarPlus className="h-3.5 w-3.5" /> New Appointment
              </Link>
            </Button>
          )}
          {can("checkout.create") && (
            <Button asChild size="sm">
              <Link href={`/checkout?patientId=${patient.id}`}>
                <ShoppingCart className="h-3.5 w-3.5" /> Checkout
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="appointments">Appointments ({patientAppointments.length})</TabsTrigger>
          <TabsTrigger value="courses">Courses ({courses.length})</TabsTrigger>
          <TabsTrigger value="transactions">Transactions ({patientTransactions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Personal Information</h3>
            <dl className="space-y-2.5 text-sm">
              <Row label="Title / Name (TH)" value={`${patient.titleTh}${patient.firstNameTh} ${patient.lastNameTh}`} />
              <Row label="Name (EN)" value={getPatientFullNameEn(patient)} />
              <Row label="Nickname" value={patient.nickname} />
              <Row label="Date of Birth" value={`${formatDate(patient.dob)} (${age} yrs)`} />
              <Row label="Blood Group" value={patient.bloodGroup} />
              <Row label="Nationality" value={patient.nationality} />
              <Row label="National ID" value={patient.nationalId ?? "—"} />
              <Row label="Passport" value={patient.passport ?? "—"} />
            </dl>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Contact</h3>
            <dl className="space-y-2.5 text-sm">
              <Row label="Phone" value={patient.phone} />
              <Row label="Address" value={patient.address} />
            </dl>
            <h3 className="mb-3 mt-5 text-sm font-semibold text-foreground">Insurance</h3>
            <dl className="space-y-2.5 text-sm">
              <Row label="Insurance Company" value={patient.insuranceCompany} icon={ShieldCheck} />
            </dl>
            <h3 className="mb-3 mt-5 text-sm font-semibold text-foreground">Registration Information</h3>
            <dl className="space-y-2.5 text-sm">
              <Row label="HN" value={patient.hn} />
              <Row label="Registration Branch" value={branch?.name ?? "—"} />
              <Row label="Customer Group" value={patient.customerGroup} />
              <Row label="Referral Channel" value={patient.referralChannel} />
              <Row label="Registered On" value={formatDate(patient.createdAt)} />
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="appointments">
          {patientAppointments.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No appointments yet" description="This patient has no appointment history." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Physiotherapist</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patientAppointments.map((a) => {
                      const svc = services.find((s) => s.id === a.serviceId);
                      const phy = staff.find((s) => s.id === a.physiotherapistId);
                      const br = branches.find((b) => b.id === a.branchId);
                      return (
                        <TableRow key={a.id} className="cursor-pointer">
                          <TableCell>
                            <Link href={`/appointments/${a.id}`} className="block hover:underline">{formatDate(a.date)}</Link>
                          </TableCell>
                          <TableCell>{a.startTime} – {a.endTime}</TableCell>
                          <TableCell>{svc?.name}</TableCell>
                          <TableCell>{phy?.name}</TableCell>
                          <TableCell className="text-muted-foreground">{br?.code}</TableCell>
                          <TableCell><StatusBadge status={a.status} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="courses">
          {courses.length === 0 ? (
            <EmptyState icon={Ticket} title="No courses purchased" description="This patient has not purchased any course packages." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((pc) => {
                const tpl = courseTemplates.find((c) => c.id === pc.courseId);
                const rem = remainingSessions(pc);
                const total = pc.purchased + pc.bonus + pc.transferIn;
                return (
                  <Link
                    key={pc.id}
                    href={`/courses/${pc.id}`}
                    className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <p className="text-sm font-semibold text-foreground">{tpl?.name}</p>
                      <StatusBadge status={pc.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">Expires {formatDate(pc.expiryDate)}</p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${total ? Math.min(100, ((total - rem) / total) * 100) : 0}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Used {total - rem} / {total} · <span className="font-medium text-foreground">{rem} remaining</span>
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions">
          {patientTransactions.length === 0 ? (
            <EmptyState icon={Receipt} title="No transactions yet" description="This patient has no billing history." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction No.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patientTransactions.map((t) => {
                      const pm = paymentMethods.find((p) => p.id === t.paymentMethodId);
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs">
                            <Link href={`/transactions/${t.id}`} className="block hover:underline">{t.transactionNo}</Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(t.date)}</TableCell>
                          <TableCell>{t.type.replace("_", " ")}</TableCell>
                          <TableCell>{formatCurrency(t.total)}</TableCell>
                          <TableCell className="text-muted-foreground">{pm?.name}</TableCell>
                          <TableCell><StatusBadge status={t.status} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof ShieldCheck }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="flex items-center gap-1.5 text-muted-foreground">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</dt>
      <dd className="text-right font-medium text-foreground">{value || "—"}</dd>
    </div>
  );
}
