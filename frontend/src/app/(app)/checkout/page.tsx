"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarPlus,
  CheckCircle2,
  Clock,
  Minus,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Tag,
  Ticket,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { getPatientFullNameTh, searchPatients } from "@/lib/domain";
import { formatCurrency, formatCurrencySigned, formatDate } from "@/lib/format";
import { remainingSessions, today } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Service, Transaction } from "@/types";

type Mode = "SINGLE" | "COURSE";
type CourseSubMode = "USE_EXISTING" | "PURCHASE";

/**
 * A counter-side change to the bill. Discounts may be entered as a percentage
 * of the subtotal; extra charges are always a flat amount.
 */
interface Adjustment {
  id: number;
  kind: "DISCOUNT" | "SURCHARGE";
  label: string;
  value: number;
  isPercent: boolean;
}

const DEFAULT_LABEL: Record<Adjustment["kind"], string> = {
  DISCOUNT: "Discount",
  SURCHARGE: "Extra charge",
};

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, activeBranchId } = useSession();
  const patients = useClinicStore((s) => s.patients);
  const branches = useClinicStore((s) => s.branches);
  const staff = useClinicStore((s) => s.staff);
  const services = useClinicStore((s) => s.services);
  const courseTemplates = useClinicStore((s) => s.courseTemplates);
  const patientCourses = useClinicStore((s) => s.patientCourses);
  const paymentMethods = useClinicStore((s) => s.paymentMethods);
  const appointments = useClinicStore((s) => s.appointments);
  const createTransaction = useClinicStore((s) => s.createTransaction);

  const preselectPatientId = searchParams.get("patientId");
  const [appointmentId, setAppointmentId] = useState(
    () => searchParams.get("appointmentId") ?? undefined
  );
  const linkedAppointment = appointments.find((a) => a.id === appointmentId);

  const [patientId, setPatientId] = useState(preselectPatientId ?? "");
  const [patientQuery, setPatientQuery] = useState("");
  const [branchId] = useState(activeBranchId ?? branches[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("SINGLE");
  const [serviceId, setServiceId] = useState(linkedAppointment?.serviceId ?? "");
  const [subMode, setSubMode] = useState<CourseSubMode>("USE_EXISTING");
  const [useCourseId, setUseCourseId] = useState("");
  const [useQty, setUseQty] = useState(1);
  const [purchaseTemplateId, setPurchaseTemplateId] = useState("");
  const [useToday, setUseToday] = useState(false);
  const [treatingStaffId, setTreatingStaffId] = useState(linkedAppointment?.physiotherapistId ?? "");
  const [salespersonId, setSalespersonId] = useState(user?.staffId ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [result, setResult] = useState<Transaction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Empty string = "use the catalogue price"; a typed value overrides it.
  const [priceOverride, setPriceOverride] = useState("");
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [adjustmentSeq, setAdjustmentSeq] = useState(1);

  const patient = patients.find((p) => p.id === patientId);
  const patientMatches = useMemo(
    () => (patientQuery ? searchPatients(patientQuery, patients).slice(0, 6) : []),
    [patientQuery, patients]
  );
  const readyForCheckout = useMemo(
    () =>
      appointments
        .filter((a) => a.date === today() && a.status === "COMPLETED" && !a.checkedOut && a.branchId === branchId)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((a) => ({ appointment: a, patient: patients.find((p) => p.id === a.patientId) }))
        .filter((x): x is { appointment: typeof x.appointment; patient: NonNullable<typeof x.patient> } => !!x.patient),
    [appointments, patients, branchId]
  );

  const activeCourses = useMemo(
    () => patientCourses.filter((pc) => pc.patientId === patientId && pc.status === "ACTIVE"),
    [patientCourses, patientId]
  );
  const enabledPayments = paymentMethods.filter((p) => p.enabled);
  const branchPhysios = staff.filter((s) => s.position === "Physiotherapist" && s.status === "ACTIVE" && s.branchIds.includes(branchId));
  // Anyone on shift can ring up a sale — the clinic has no dedicated front desk.
  const branchSales = staff.filter((s) => s.status === "ACTIVE" && s.branchIds.includes(branchId));

  const selectedService: Service | undefined = services.find((s) => s.id === serviceId);
  const selectedUseCourse = patientCourses.find((pc) => pc.id === useCourseId);
  const selectedUseCourseTemplate = selectedUseCourse ? courseTemplates.find((c) => c.id === selectedUseCourse.courseId) : undefined;
  const selectedPurchaseTemplate = courseTemplates.find((c) => c.id === purchaseTemplateId);

  // The line being charged for, if any — course-usage checkouts bill nothing.
  const baseItem =
    mode === "SINGLE"
      ? selectedService
        ? { label: selectedService.name, listPrice: selectedService.price }
        : null
      : subMode === "PURCHASE" && selectedPurchaseTemplate
      ? {
          label: `${selectedPurchaseTemplate.name} (${selectedPurchaseTemplate.sessions} sessions)`,
          listPrice: selectedPurchaseTemplate.price,
        }
      : null;

  const parsedOverride = priceOverride.trim() === "" ? null : Math.max(0, Math.round(Number(priceOverride)));
  const overrideIsValid = parsedOverride !== null && Number.isFinite(parsedOverride);
  const basePrice = baseItem ? (overrideIsValid ? parsedOverride! : baseItem.listPrice) : 0;
  const priceWasOverridden = !!baseItem && overrideIsValid && parsedOverride !== baseItem.listPrice;
  const subtotal = basePrice;

  // Percentage discounts resolve against the subtotal, so they follow a price
  // override automatically.
  const resolvedAdjustments = adjustments
    .map((a) => {
      const magnitude = a.isPercent ? Math.round((subtotal * a.value) / 100) : Math.round(a.value);
      const amount = a.kind === "DISCOUNT" ? -magnitude : magnitude;
      return {
        ...a,
        resolvedLabel: a.label.trim() || DEFAULT_LABEL[a.kind],
        amount: Number.isFinite(amount) ? amount : 0,
      };
    })
    .filter((a) => a.amount !== 0);

  const adjustmentTotal = resolvedAdjustments.reduce((sum, a) => sum + a.amount, 0);
  const total = Math.max(0, subtotal + adjustmentTotal);
  // Discounting past free is almost always a typo — block confirm rather than
  // silently clamping the patient's bill to zero.
  const overDiscounted = subtotal + adjustmentTotal < 0;

  function addAdjustment(kind: Adjustment["kind"]) {
    setAdjustments((list) => [...list, { id: adjustmentSeq, kind, label: "", value: 0, isPercent: false }]);
    setAdjustmentSeq((n) => n + 1);
  }
  function updateAdjustment(id: number, patch: Partial<Adjustment>) {
    setAdjustments((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function removeAdjustment(id: number) {
    setAdjustments((list) => list.filter((a) => a.id !== id));
  }

  const needsTreatingStaff =
    mode === "SINGLE" || (mode === "COURSE" && (subMode === "USE_EXISTING" ? !!useCourseId : useToday));
  const needsSalesperson = mode === "SINGLE" || (mode === "COURSE" && subMode === "PURCHASE");

  const canConfirm =
    !!patientId &&
    !!paymentMethodId &&
    (mode === "SINGLE"
      ? !!serviceId
      : subMode === "USE_EXISTING"
      ? !!useCourseId && useQty > 0 && useQty <= (selectedUseCourse ? remainingSessions(selectedUseCourse) : 0)
      : !!purchaseTemplateId) &&
    (!needsTreatingStaff || !!treatingStaffId) &&
    (!needsSalesperson || !!salespersonId) &&
    !overDiscounted;

  async function handleConfirm() {
    if (!canConfirm || !user || submitting) return;
    setSubmitting(true);
    try {
      const txn = await createTransaction({
        patientId,
        branchId,
        appointmentId,
        serviceId: mode === "SINGLE" ? serviceId : undefined,
        purchaseCourseTemplateId: mode === "COURSE" && subMode === "PURCHASE" ? purchaseTemplateId : undefined,
        useCoursePatientCourseId: mode === "COURSE" && subMode === "USE_EXISTING" ? useCourseId : undefined,
        useSessionsCount: mode === "COURSE" && subMode === "USE_EXISTING" ? useQty : undefined,
        useNewlyPurchasedSession: mode === "COURSE" && subMode === "PURCHASE" ? useToday : undefined,
        treatingStaffId: needsTreatingStaff ? treatingStaffId : undefined,
        salespersonId: needsSalesperson ? salespersonId : undefined,
        paymentMethodId,
        servicePrice: mode === "SINGLE" && priceWasOverridden ? basePrice : undefined,
        coursePurchasePrice:
          mode === "COURSE" && subMode === "PURCHASE" && priceWasOverridden ? basePrice : undefined,
        adjustments: resolvedAdjustments.map((a) => ({ label: a.resolvedLabel, amount: a.amount })),
      });
      setResult(txn);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to take this payment");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const pm = paymentMethods.find((p) => p.id === result.paymentMethodId);
    const treatingStaff = staff.find((s) => s.id === result.treatingStaffId);
    const salesperson = staff.find((s) => s.id === result.salespersonId);
    const resultAdjustments = result.items.filter((i) => i.kind === "DISCOUNT" || i.kind === "SURCHARGE");
    return (
      <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center py-10 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <p className="text-lg font-semibold text-foreground">Payment Successful</p>
        <p className="mt-1 text-sm text-muted-foreground">Transaction {result.transactionNo} has been recorded.</p>

        <div className="mt-5 w-full space-y-2.5 rounded-xl border border-border bg-card p-5 text-left text-sm">
          <SummaryRow label="Transaction No." value={result.transactionNo} mono />
          <SummaryRow label="Patient" value={patient ? getPatientFullNameTh(patient) : "-"} />
          {resultAdjustments.length > 0 && (
            <>
              <SummaryRow label="Subtotal" value={formatCurrency(result.subtotal)} />
              {resultAdjustments.map((a, i) => (
                <SummaryRow key={i} label={a.description} value={formatCurrencySigned(a.amount)} />
              ))}
            </>
          )}
          <SummaryRow label="Amount Paid" value={formatCurrency(result.total)} bold />
          <SummaryRow label="Payment Method" value={pm?.name ?? "-"} />
          {treatingStaff && <SummaryRow label="Treating Staff" value={treatingStaff.name} />}
          {salesperson && <SummaryRow label="Salesperson" value={salesperson.name} />}
          {result.courseImpact.length > 0 && (
            <>
              <Separator className="my-2" />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Course Impact</p>
              {result.courseImpact.map((c, i) => (
                <SummaryRow key={i} label={c.label} value={`${c.quantity > 0 ? "+" : ""}${c.quantity}`} />
              ))}
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/transactions/${result.id}`}>View Transaction</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/appointments/new?patientId=${patientId}`}>
              <CalendarPlus className="h-4 w-4" /> Book Next Appointment
            </Link>
          </Button>
          <Button onClick={() => router.push(`/patients/${patientId}`)}>Finish</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Checkout" description="Bill services, courses and record payment" />

      {!patient ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Select Patient</CardTitle></CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Search HN, name or phone..." className="pl-9" autoFocus />
              </div>
              {patientMatches.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-lg border border-border">
                  {patientMatches.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setPatientId(p.id); setAppointmentId(undefined); setPatientQuery(""); }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="font-medium">{getPatientFullNameTh(p)}</span>
                      <span className="font-mono text-xs text-muted-foreground">{p.hn}</span>
                    </button>
                  ))}
                </div>
              )}

              {!patientQuery && (
                <div className="mt-6">
                  <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Ready for Checkout Today
                  </p>
                  {readyForCheckout.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      No completed visits waiting for checkout yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {readyForCheckout.map(({ appointment: a, patient: p }) => {
                        const svc = services.find((s) => s.id === a.serviceId);
                        return (
                          <button
                            key={a.id}
                            onClick={() => {
                              setPatientId(p.id);
                              setAppointmentId(a.id);
                              setMode("SINGLE");
                              setServiceId(a.serviceId);
                              setTreatingStaffId(a.physiotherapistId);
                            }}
                            className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">{getPatientFullNameTh(p)}</p>
                              <p className="text-xs text-muted-foreground">{svc?.name} · {a.startTime}–{a.endTime}</p>
                            </div>
                            <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">Completed</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="rounded-xl border border-border bg-card p-5">
            <p className="mb-4 text-sm font-semibold text-foreground">How Checkout Works</p>
            <div className="space-y-4">
              {[
                { n: 1, label: "Select Patient", desc: "Search or pick from today's completed visits" },
                { n: 2, label: "Choose Service or Course", desc: "Single visit, existing course, or new package" },
                { n: 3, label: "Confirm Payment", desc: "Record the payment method to finish" },
              ].map((step) => (
                <div key={step.n} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {step.n}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">{getPatientFullNameTh(patient)}</p>
                <p className="font-mono text-xs text-muted-foreground">{patient.hn} · {branches.find((b) => b.id === branchId)?.name}</p>
                {linkedAppointment && <p className="mt-1 text-xs text-muted-foreground">Linked visit: {formatDate(linkedAppointment.date)} {linkedAppointment.startTime}</p>}
              </div>
              {!preselectPatientId && (
                <Button variant="ghost" size="icon" onClick={() => { setPatientId(""); setAppointmentId(undefined); }}><X className="h-4 w-4" /></Button>
              )}
            </div>

            <div className="flex gap-2 rounded-lg border border-border bg-muted/40 p-1">
              <button
                onClick={() => { setMode("SINGLE"); setPriceOverride(""); }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === "SINGLE" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"}`}
              >
                Assessment / Single Visit
              </button>
              <button
                onClick={() => { setMode("COURSE"); setPriceOverride(""); }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === "COURSE" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"}`}
              >
                Course / Package
              </button>
            </div>

            {mode === "SINGLE" ? (
              <Card>
                <CardHeader><CardTitle className="text-base">Select Service</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {services.filter((s) => s.status === "ACTIVE").map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setServiceId(s.id); setPriceOverride(""); }}
                        className={`rounded-lg border px-3.5 py-3 text-left transition-colors ${serviceId === s.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">{s.name}</p>
                          <span className="text-xs text-muted-foreground">{s.duration} min</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-primary">{formatCurrency(s.price)}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSubMode("USE_EXISTING"); setPriceOverride(""); }}
                    disabled={activeCourses.length === 0}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${subMode === "USE_EXISTING" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    Use Existing Course
                  </button>
                  <button
                    onClick={() => { setSubMode("PURCHASE"); setPriceOverride(""); }}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${subMode === "PURCHASE" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    Purchase New Course
                  </button>
                </div>

                {subMode === "USE_EXISTING" ? (
                  activeCourses.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      This patient has no active course. Switch to &quot;Purchase New Course&quot; instead.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {activeCourses.map((pc) => {
                        const tpl = courseTemplates.find((c) => c.id === pc.courseId);
                        const rem = remainingSessions(pc);
                        const selected = useCourseId === pc.id;
                        return (
                          <div
                            key={pc.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => { setUseCourseId(pc.id); setUseQty(1); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setUseCourseId(pc.id); setUseQty(1); } }}
                            className={`block w-full cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors ${selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"}`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-foreground">{tpl?.name}</p>
                              <Ticket className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Purchased {pc.purchased} · Used {pc.used} · Expires {formatDate(pc.expiryDate)}
                            </p>
                            <p className="mt-1 text-sm font-medium text-foreground">{rem} sessions remaining</p>
                            {selected && (
                              <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                <span className="text-xs font-medium text-muted-foreground">Use sessions:</span>
                                <div className="flex items-center gap-2">
                                  <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => setUseQty((q) => Math.max(1, q - 1))}>
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-4 text-center text-sm font-semibold">{useQty}</span>
                                  <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => setUseQty((q) => Math.min(rem, q + 1))}>
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                                <span className="text-xs text-muted-foreground">→ {rem - useQty} remaining after</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Purchase New Course</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {courseTemplates.filter((c) => c.status === "ACTIVE").map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { setPurchaseTemplateId(c.id); setPriceOverride(""); }}
                            className={`rounded-lg border px-3.5 py-3 text-left transition-colors ${purchaseTemplateId === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                          >
                            <p className="text-sm font-medium text-foreground">{c.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {c.sessions} Sessions {c.bonusSessions > 0 && `+ ${c.bonusSessions} Bonus`} · Expires in {c.expiryDays} days
                            </p>
                            <p className="mt-1 text-sm font-semibold text-primary">{formatCurrency(c.price)}</p>
                          </button>
                        ))}
                      </div>
                      {selectedPurchaseTemplate && (
                        <label className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3.5 py-3 text-sm">
                          <Checkbox checked={useToday} onCheckedChange={(v) => setUseToday(!!v)} />
                          Use 1 session from this course today
                        </label>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Price Adjustment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {baseItem ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="base-price">Charged price</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          ฿
                        </span>
                        <Input
                          id="base-price"
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={priceOverride}
                          placeholder={String(baseItem.listPrice)}
                          onChange={(e) => setPriceOverride(e.target.value)}
                          className="h-9 w-36 pl-6"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {baseItem.label} · list {formatCurrency(baseItem.listPrice)}
                      </p>
                      {priceWasOverridden && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setPriceOverride("")}>
                          <RotateCcw className="h-3.5 w-3.5" /> Reset
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {mode === "COURSE" && subMode === "USE_EXISTING"
                      ? "Using an existing course costs nothing — add an extra charge below if anything else was sold today."
                      : "Select a service or course first to set its price."}
                  </p>
                )}

                {adjustments.length > 0 && (
                  <div className="space-y-2">
                    {adjustments.map((a) => (
                      <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
                            a.kind === "DISCOUNT"
                              ? "bg-success/10 text-success"
                              : "bg-warning/15 text-[#8A5A00]"
                          }`}
                        >
                          {a.kind === "DISCOUNT" ? "Discount" : "Charge"}
                        </span>
                        <Input
                          value={a.label}
                          placeholder={DEFAULT_LABEL[a.kind]}
                          onChange={(e) => updateAdjustment(a.id, { label: e.target.value })}
                          className="h-8 min-w-32 flex-1"
                          aria-label="Reason"
                        />
                        {a.kind === "DISCOUNT" && (
                          <div className="flex shrink-0 items-center rounded-lg border border-border p-0.5">
                            {[
                              { on: false, text: "฿" },
                              { on: true, text: "%" },
                            ].map((opt) => (
                              <button
                                key={opt.text}
                                type="button"
                                onClick={() => updateAdjustment(a.id, { isPercent: opt.on })}
                                className={`cursor-pointer rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                                  a.isPercent === opt.on
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {opt.text}
                              </button>
                            ))}
                          </div>
                        )}
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={a.value === 0 ? "" : a.value}
                          placeholder="0"
                          onChange={(e) =>
                            updateAdjustment(a.id, { value: Math.max(0, Number(e.target.value) || 0) })
                          }
                          className="h-8 w-24 shrink-0"
                          aria-label={a.kind === "DISCOUNT" ? "Discount amount" : "Charge amount"}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => removeAdjustment(a.id)}
                          aria-label="Remove adjustment"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => addAdjustment("DISCOUNT")}>
                    <Tag className="h-3.5 w-3.5" /> Add Discount
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addAdjustment("SURCHARGE")}>
                    <Plus className="h-3.5 w-3.5" /> Add Extra Charge
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Staff</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Treating Staff {needsTreatingStaff && <span className="text-destructive">*</span>}</Label>
                  <Select value={treatingStaffId} onValueChange={setTreatingStaffId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select physiotherapist" /></SelectTrigger>
                    <SelectContent>
                      {branchPhysios.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Salesperson {needsSalesperson && <span className="text-destructive">*</span>}</Label>
                  <Select value={salespersonId} onValueChange={setSalespersonId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>
                      {branchSales.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-4 rounded-xl border border-border bg-card p-5">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ShoppingCart className="h-4 w-4" /> Order Summary
              </h3>

              <div className="space-y-2 text-sm">
                {baseItem && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{baseItem.label}</span>
                    <span className="shrink-0 text-right">
                      {priceWasOverridden && (
                        <span className="mr-1.5 text-xs text-muted-foreground line-through">
                          {formatCurrency(baseItem.listPrice)}
                        </span>
                      )}
                      {formatCurrency(basePrice)}
                    </span>
                  </div>
                )}
                {mode === "COURSE" && subMode === "PURCHASE" && selectedPurchaseTemplate && (
                  <>
                    {selectedPurchaseTemplate.bonusSessions > 0 && (
                      <div className="flex justify-between text-success"><span>+ {selectedPurchaseTemplate.bonusSessions} Bonus Sessions</span><span>฿0</span></div>
                    )}
                    {useToday && (
                      <div className="flex justify-between text-muted-foreground"><span>Session Usage Today</span><span>-1 session</span></div>
                    )}
                  </>
                )}
                {mode === "COURSE" && subMode === "USE_EXISTING" && selectedUseCourse && (
                  <div className="flex justify-between"><span className="text-muted-foreground">{selectedUseCourseTemplate?.name} — Session Usage ×{useQty}</span><span>฿0</span></div>
                )}
                {!baseItem && !(mode === "COURSE" && (useCourseId || purchaseTemplateId)) && (
                  <p className="text-xs text-muted-foreground">Select a service or course to see the summary.</p>
                )}
              </div>

              {resolvedAdjustments.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {resolvedAdjustments.map((a) => (
                      <div key={a.id} className="flex justify-between gap-3">
                        <span className="truncate text-muted-foreground">
                          {a.resolvedLabel}
                          {a.isPercent && a.kind === "DISCOUNT" && (
                            <span className="ml-1 text-xs">({a.value}%)</span>
                          )}
                        </span>
                        <span className={`shrink-0 ${a.amount < 0 ? "text-success" : "text-[#8A5A00]"}`}>
                          {formatCurrencySigned(a.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <Separator />
              <div className="flex justify-between text-base font-semibold text-foreground">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
              {overDiscounted && (
                <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  Discounts exceed the subtotal. Reduce them before taking payment.
                </p>
              )}

              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <div className="grid grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2">
                  {enabledPayments.map((pm) => (
                    <button
                      key={pm.id}
                      onClick={() => setPaymentMethodId(pm.id)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${paymentMethodId === pm.id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}
                    >
                      {pm.name}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="w-full" size="lg" disabled={!canConfirm || submitting} onClick={handleConfirm}>
                Confirm Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SummaryRow({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "text-base font-semibold text-foreground" : "font-medium text-foreground"} ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutContent />
    </Suspense>
  );
}
