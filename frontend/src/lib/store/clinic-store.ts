import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  Appointment,
  AppointmentStatus,
  AppUser,
  Branch,
  CommissionRule,
  CourseLedgerEntry,
  CourseTemplate,
  MasterDataItem,
  Patient,
  PatientCourse,
  PaymentMethod,
  ResourceRoom,
  Role,
  Service,
  Staff,
  Transaction,
} from "@/types";

import { branches as seedBranches } from "@/lib/mock-data/branches";
import { staff as seedStaff } from "@/lib/mock-data/staff";
import { services as seedServices, courseTemplates as seedCourseTemplates } from "@/lib/mock-data/services";
import { paymentMethods as seedPaymentMethods } from "@/lib/mock-data/payment-methods";
import { resources as seedResources } from "@/lib/mock-data/resources";
import { masterData as seedMasterData } from "@/lib/mock-data/master-data";
import { commissionRules as seedCommissionRules } from "@/lib/mock-data/commission-rules";
import { patients as seedPatients, generateHN } from "@/lib/mock-data/patients";
import { patientCourses as seedPatientCourses, courseLedger as seedCourseLedger, TODAY } from "@/lib/mock-data/course-data";
import { appointments as seedAppointments } from "@/lib/mock-data/appointments";
import { transactions as seedTransactions } from "@/lib/mock-data/transactions";
import { users as seedUsers, getUserByUsername } from "@/lib/mock-data/users";

const VALID_ROLES: Role[] = ["ADMIN", "PHYSIOTHERAPIST"];

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function remaining(pc: PatientCourse): number {
  return pc.purchased + pc.bonus + pc.transferIn - pc.used - pc.transferOut;
}

function computeStatus(pc: PatientCourse): PatientCourse["status"] {
  const rem = remaining(pc);
  if (pc.expiryDate < TODAY) return "EXPIRED";
  if (rem <= 0) return "USED_UP";
  return "ACTIVE";
}

export interface Session {
  user: AppUser | null;
  activeBranchId: string | null;
  accessToken: string | null;
}

export interface CheckoutAdjustment {
  /** Shown on the receipt, e.g. "Loyal patient discount" or "After-hours fee". */
  label: string;
  /** Signed: negative discounts the bill, positive adds to it. */
  amount: number;
}

export interface CheckoutInput {
  patientId: string;
  branchId: string;
  appointmentId?: string;
  serviceId?: string;
  purchaseCourseTemplateId?: string;
  useCoursePatientCourseId?: string;
  useSessionsCount?: number;
  useNewlyPurchasedSession?: boolean;
  treatingStaffId?: string;
  salespersonId?: string;
  paymentMethodId: string;
  /** Counter override for the service line; falls back to the catalogue price. */
  servicePrice?: number;
  /** Counter override for the course-purchase line. */
  coursePurchasePrice?: number;
  /** Manual discounts and extra charges applied to the whole bill. */
  adjustments?: CheckoutAdjustment[];
}

export interface NewAppointmentInput {
  patientId: string;
  date: string;
  startTime: string;
  endTime: string;
  branchId: string;
  physiotherapistId: string;
  serviceId: string;
  resourceId: string;
  note?: string;
}

interface ClinicState {
  session: Session;
  seq: number;
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  branches: Branch[];
  staff: Staff[];
  users: AppUser[];
  services: Service[];
  courseTemplates: CourseTemplate[];
  paymentMethods: PaymentMethod[];
  resources: ResourceRoom[];
  masterData: MasterDataItem[];
  commissionRules: CommissionRule[];

  patients: Patient[];
  patientCourses: PatientCourse[];
  courseLedger: CourseLedgerEntry[];
  appointments: Appointment[];
  transactions: Transaction[];

  // auth
  login: (username: string, password: string) => { ok: boolean; error?: string };
  setAuthenticatedSession: (user: AppUser, accessToken: string) => void;
  logout: () => void;
  setActiveBranch: (branchId: string | null) => void;

  // admin: branches
  addBranch: (data: Omit<Branch, "id">) => void;
  updateBranch: (id: string, data: Partial<Branch>) => void;
  toggleBranchStatus: (id: string) => void;

  // admin: staff
  addStaff: (data: Omit<Staff, "id">) => void;
  updateStaff: (id: string, data: Partial<Staff>) => void;
  toggleStaffStatus: (id: string) => void;
  deleteStaff: (id: string) => void;

  // admin: users
  addUser: (data: Omit<AppUser, "id">) => void;
  updateUser: (id: string, data: Partial<AppUser>) => void;
  toggleUserStatus: (id: string) => void;
  deleteUser: (id: string) => void;

  // admin: services / courses
  addService: (data: Omit<Service, "id">) => void;
  updateService: (id: string, data: Partial<Service>) => void;
  toggleServiceStatus: (id: string) => void;
  addCourseTemplate: (data: Omit<CourseTemplate, "id">) => void;
  updateCourseTemplate: (id: string, data: Partial<CourseTemplate>) => void;
  toggleCourseTemplateStatus: (id: string) => void;

  // admin: payment methods
  togglePaymentMethod: (id: string) => void;

  // admin: resources
  addResource: (data: Omit<ResourceRoom, "id">) => void;
  updateResource: (id: string, data: Partial<ResourceRoom>) => void;
  toggleResourceStatus: (id: string) => void;

  // admin: commission rules
  addCommissionRule: (data: Omit<CommissionRule, "id">) => void;
  updateCommissionRule: (id: string, data: Partial<CommissionRule>) => void;
  toggleCommissionRuleStatus: (id: string) => void;

  // admin: master data
  addMasterDataItem: (data: Omit<MasterDataItem, "id">) => void;
  updateMasterDataItem: (id: string, data: Partial<MasterDataItem>) => void;
  toggleMasterDataItemStatus: (id: string) => void;

  // patients
  addPatient: (data: Omit<Patient, "id" | "hn" | "createdAt">) => Patient;
  updatePatient: (id: string, data: Partial<Patient>) => void;

  // appointments
  checkConflict: (input: NewAppointmentInput, excludeId?: string) => string | null;
  addAppointment: (input: NewAppointmentInput) => { ok: boolean; error?: string; appointment?: Appointment };
  checkInAppointment: (id: string) => void;
  startService: (id: string) => void;
  completeService: (id: string) => void;
  cancelAppointment: (id: string, reason: string) => void;
  markNoShow: (id: string) => void;
  rescheduleAppointment: (id: string, date: string, startTime: string, endTime: string, reason?: string) => Appointment | null;

  // checkout / transactions
  createTransaction: (input: CheckoutInput, actorName: string) => Transaction;
  voidTransaction: (id: string, reason: string, actorName: string) => void;

  // course transfer (staff-executed)
  transferCourseSessions: (
    fromPatientCourseId: string,
    toPatientId: string,
    sessions: number,
    actorName: string
  ) => { ok: boolean; error?: string };

  resetDemoData: () => void;
}

function findCommissionRule(
  rules: CommissionRule[],
  appliesTo: "TREATMENT" | "SALES",
  targetType: "SERVICE" | "COURSE",
  targetId: string,
  date: string
): CommissionRule | undefined {
  const specific = rules.find(
    (r) =>
      r.status === "ACTIVE" &&
      (r.appliesTo === appliesTo || r.appliesTo === "BOTH") &&
      r.targetType === targetType &&
      r.targetId === targetId &&
      r.effectiveDate <= date
  );
  if (specific) return specific;
  const categoryWildcard = rules.find(
    (r) =>
      r.status === "ACTIVE" &&
      (r.appliesTo === appliesTo || r.appliesTo === "BOTH") &&
      r.targetType === targetType &&
      !r.targetId &&
      r.effectiveDate <= date
  );
  if (categoryWildcard) return categoryWildcard;
  return rules.find(
    (r) =>
      r.status === "ACTIVE" &&
      (r.appliesTo === appliesTo || r.appliesTo === "BOTH") &&
      r.targetType === "ALL" &&
      r.effectiveDate <= date
  );
}

const initialState = {
  session: { user: null, activeBranchId: null, accessToken: null } as Session,
  seq: 100000,
  branches: seedBranches,
  staff: seedStaff,
  users: seedUsers,
  services: seedServices,
  courseTemplates: seedCourseTemplates,
  paymentMethods: seedPaymentMethods,
  resources: seedResources,
  masterData: seedMasterData,
  commissionRules: seedCommissionRules,
  patients: seedPatients,
  patientCourses: seedPatientCourses,
  courseLedger: seedCourseLedger,
  appointments: seedAppointments,
  transactions: seedTransactions,
};

export const useClinicStore = create<ClinicState>()(
  persist(
    immer((set, get) => ({
      ...initialState,
      hasHydrated: false,
      setHasHydrated: (v) => set((s) => { s.hasHydrated = v; }),

      login: (username, password) => {
        const user = getUserByUsername(username);
        if (!user || user.password !== password) return { ok: false, error: "Invalid username or password" };
        if (user.status !== "ACTIVE") return { ok: false, error: "This account has been deactivated" };
        set((s) => {
          s.session.user = { ...user, lastLogin: nowIso() };
          s.session.activeBranchId = user.branchIds[0] ?? null;
          const idx = s.users.findIndex((u) => u.id === user.id);
          if (idx >= 0) s.users[idx].lastLogin = nowIso();
        });
        return { ok: true };
      },
      setAuthenticatedSession: (user, accessToken) => set((s) => {
        s.session.user = user;
        s.session.accessToken = accessToken;
        s.session.activeBranchId = user.branchIds[0] ?? null;
      }),
      logout: () => set((s) => {
        s.session.user = null;
        s.session.activeBranchId = null;
        s.session.accessToken = null;
      }),
      setActiveBranch: (branchId) => set((s) => { s.session.activeBranchId = branchId; }),

      addBranch: (data) => set((s) => { s.branches.push({ ...data, id: `br-${s.seq++}` }); }),
      updateBranch: (id, data) => set((s) => {
        const b = s.branches.find((x) => x.id === id);
        if (b) Object.assign(b, data);
      }),
      toggleBranchStatus: (id) => set((s) => {
        const b = s.branches.find((x) => x.id === id);
        if (b) b.status = b.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      }),

      addStaff: (data) => set((s) => { s.staff.push({ ...data, id: `stf-${s.seq++}` }); }),
      updateStaff: (id, data) => set((s) => {
        const st = s.staff.find((x) => x.id === id);
        if (st) Object.assign(st, data);
      }),
      toggleStaffStatus: (id) => set((s) => {
        const st = s.staff.find((x) => x.id === id);
        if (st) st.status = st.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      }),
      deleteStaff: (id) => set((s) => {
        const item = s.staff.find((x) => x.id === id);
        if (item) item.deletedAt = nowIso();
      }),

      addUser: (data) => set((s) => { s.users.push({ ...data, id: `usr-${s.seq++}` }); }),
      updateUser: (id, data) => set((s) => {
        const u = s.users.find((x) => x.id === id);
        if (u) Object.assign(u, data);
      }),
      toggleUserStatus: (id) => set((s) => {
        const u = s.users.find((x) => x.id === id);
        if (u) u.status = u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      }),
      deleteUser: (id) => set((s) => {
        const item = s.users.find((x) => x.id === id);
        if (item) { item.deletedAt = nowIso(); item.status = "INACTIVE"; }
      }),

      addService: (data) => set((s) => { s.services.push({ ...data, id: `svc-${s.seq++}` }); }),
      updateService: (id, data) => set((s) => {
        const sv = s.services.find((x) => x.id === id);
        if (sv) Object.assign(sv, data);
      }),
      toggleServiceStatus: (id) => set((s) => {
        const sv = s.services.find((x) => x.id === id);
        if (sv) sv.status = sv.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      }),
      addCourseTemplate: (data) => set((s) => { s.courseTemplates.push({ ...data, id: `crs-${s.seq++}` }); }),
      updateCourseTemplate: (id, data) => set((s) => {
        const c = s.courseTemplates.find((x) => x.id === id);
        if (c) Object.assign(c, data);
      }),
      toggleCourseTemplateStatus: (id) => set((s) => {
        const c = s.courseTemplates.find((x) => x.id === id);
        if (c) c.status = c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      }),

      togglePaymentMethod: (id) => set((s) => {
        const p = s.paymentMethods.find((x) => x.id === id);
        if (p) p.enabled = !p.enabled;
      }),

      addResource: (data) => set((s) => { s.resources.push({ ...data, id: `res-${s.seq++}` }); }),
      updateResource: (id, data) => set((s) => {
        const r = s.resources.find((x) => x.id === id);
        if (r) Object.assign(r, data);
      }),
      toggleResourceStatus: (id) => set((s) => {
        const r = s.resources.find((x) => x.id === id);
        if (r) r.status = r.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      }),

      addCommissionRule: (data) => set((s) => { s.commissionRules.push({ ...data, id: `cr-${s.seq++}` }); }),
      updateCommissionRule: (id, data) => set((s) => {
        const r = s.commissionRules.find((x) => x.id === id);
        if (r) Object.assign(r, data);
      }),
      toggleCommissionRuleStatus: (id) => set((s) => {
        const r = s.commissionRules.find((x) => x.id === id);
        if (r) r.status = r.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      }),

      addMasterDataItem: (data) => set((s) => { s.masterData.push({ ...data, id: `md-${s.seq++}` }); }),
      updateMasterDataItem: (id, data) => set((s) => {
        const m = s.masterData.find((x) => x.id === id);
        if (m) Object.assign(m, data);
      }),
      toggleMasterDataItemStatus: (id) => set((s) => {
        const m = s.masterData.find((x) => x.id === id);
        if (m) m.status = m.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      }),

      addPatient: (data) => {
        const state = get();
        const branchIndex = state.branches.findIndex((b) => b.id === data.registrationBranchId);
        const branchSeqNo = branchIndex >= 0 ? branchIndex + 1 : 9;
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const sameMonth = state.patients.filter(
          (p) => p.registrationBranchId === data.registrationBranchId && p.hn.slice(0, 6) === `${String(year % 100).padStart(2, "0")}${String(branchSeqNo).padStart(2, "0")}${String(month).padStart(2, "0")}`
        );
        const seqNo = sameMonth.length + 1;
        const hn = generateHN(branchSeqNo, year, month, seqNo);
        const newPatient: Patient = { ...data, id: `p-${get().seq}`, hn, createdAt: TODAY };
        set((s) => { s.patients.push(newPatient); s.seq++; });
        return newPatient;
      },
      updatePatient: (id, data) => set((s) => {
        const p = s.patients.find((x) => x.id === id);
        if (p) Object.assign(p, data);
      }),

      checkConflict: (input, excludeId) => {
        const { appointments } = get();
        const overlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
          aStart < bEnd && bStart < aEnd;
        const activeStatuses: AppointmentStatus[] = ["CONFIRMED", "ARRIVED", "IN_SERVICE", "COMPLETED"];
        for (const apt of appointments) {
          if (apt.id === excludeId) continue;
          if (apt.date !== input.date) continue;
          if (!activeStatuses.includes(apt.status)) continue;
          if (!overlap(input.startTime, input.endTime, apt.startTime, apt.endTime)) continue;
          if (apt.physiotherapistId === input.physiotherapistId) {
            return "Physiotherapist already has an appointment at this time.";
          }
          if (apt.resourceId === input.resourceId) {
            return "This treatment room is unavailable at this time.";
          }
        }
        return null;
      },

      addAppointment: (input) => {
        const conflict = get().checkConflict(input);
        if (conflict) return { ok: false, error: conflict };
        const id = `apt-${get().seq}`;
        const appointment: Appointment = {
          id,
          patientId: input.patientId,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          branchId: input.branchId,
          physiotherapistId: input.physiotherapistId,
          serviceId: input.serviceId,
          resourceId: input.resourceId,
          note: input.note,
          status: "CONFIRMED",
          createdAt: nowIso(),
        };
        set((s) => { s.appointments.push(appointment); s.seq++; });
        return { ok: true, appointment };
      },
      checkInAppointment: (id) => set((s) => {
        const a = s.appointments.find((x) => x.id === id);
        if (a) a.status = "ARRIVED";
      }),
      startService: (id) => set((s) => {
        const a = s.appointments.find((x) => x.id === id);
        if (a) a.status = "IN_SERVICE";
      }),
      completeService: (id) => set((s) => {
        const a = s.appointments.find((x) => x.id === id);
        if (a) a.status = "COMPLETED";
      }),
      cancelAppointment: (id, reason) => set((s) => {
        const a = s.appointments.find((x) => x.id === id);
        if (a) { a.status = "CANCELLED"; a.note = reason; }
      }),
      markNoShow: (id) => set((s) => {
        const a = s.appointments.find((x) => x.id === id);
        if (a) a.status = "NO_SHOW";
      }),
      rescheduleAppointment: (id, date, startTime, endTime, reason) => {
        const state = get();
        const original = state.appointments.find((a) => a.id === id);
        if (!original) return null;
        const newId = `apt-${state.seq}`;
        const newAppt: Appointment = {
          ...original,
          id: newId,
          date,
          startTime,
          endTime,
          status: "CONFIRMED",
          createdAt: nowIso(),
          checkedOut: false,
          note: reason
            ? `Rescheduled from ${original.date} ${original.startTime} — ${reason}`
            : `Rescheduled from ${original.date} ${original.startTime}`,
        };
        set((s) => {
          const o = s.appointments.find((a) => a.id === id);
          if (o) o.status = "RESCHEDULED";
          s.appointments.push(newAppt);
          s.seq++;
        });
        return newAppt;
      },

      createTransaction: (input, actorName) => {
        const state = get();
        const txnId = `txn-live-${state.seq}`;
        const txnNo = `INV-2026-${String(state.seq).padStart(6, "0")}`;
        const items: Transaction["items"] = [];
        const courseImpact: Transaction["courseImpact"] = [];
        const commission: Transaction["commission"] = [];
        let subtotal = 0;
        let type: Transaction["type"] = "SINGLE_VISIT";
        let patientCourseId: string | undefined;
        let newPatientCourse: PatientCourse | null = null;

        const adjustments = (input.adjustments ?? []).filter((a) => a.amount !== 0);
        const adjustmentTotal = adjustments.reduce((sum, a) => sum + a.amount, 0);
        const discountTotal = adjustments.reduce((sum, a) => sum + Math.min(0, a.amount), 0);
        const servicePrice = input.servicePrice ?? state.services.find((x) => x.id === input.serviceId)?.price ?? 0;
        const coursePrice =
          input.coursePurchasePrice ??
          state.courseTemplates.find((x) => x.id === input.purchaseCourseTemplateId)?.price ??
          0;
        const grossTotal = (input.serviceId ? servicePrice : 0) + (input.purchaseCourseTemplateId ? coursePrice : 0);
        const netTotal = Math.max(0, grossTotal + adjustmentTotal);

        /**
         * Percentage commission follows what was actually earned on the item:
         * a counter price override and any discount both shrink it, spread
         * across the base lines in proportion to their price. Ad-hoc extra
         * charges (equipment, after-hours fees) are NOT part of the item that
         * the commission rule prices, so they never inflate it.
         */
        const discountRatio =
          grossTotal > 0 ? Math.max(0, (grossTotal + discountTotal) / grossTotal) : 1;
        const commissionBase = (lineAmount: number) => lineAmount * discountRatio;

        if (input.serviceId) {
          const svc = state.services.find((x) => x.id === input.serviceId)!;
          items.push({ description: svc.name, qty: 1, amount: servicePrice, kind: "BASE" });
          subtotal += servicePrice;
          type = svc.type === "ASSESSMENT" ? "ASSESSMENT" : "SINGLE_VISIT";
          if (input.treatingStaffId) {
            const rule = findCommissionRule(state.commissionRules, "TREATMENT", "SERVICE", svc.id, TODAY);
            if (rule) {
              commission.push({
                ruleId: rule.id, ruleName: rule.name, staffId: input.treatingStaffId, type: "TREATMENT",
                amount: rule.commissionType === "PERCENTAGE" ? Math.round((commissionBase(servicePrice) * rule.value) / 100) : rule.value,
              });
            }
          }
          if (input.salespersonId) {
            const rule = findCommissionRule(state.commissionRules, "SALES", "SERVICE", svc.id, TODAY);
            if (rule) {
              commission.push({
                ruleId: rule.id, ruleName: rule.name, staffId: input.salespersonId, type: "SALES",
                amount: rule.commissionType === "PERCENTAGE" ? Math.round((commissionBase(servicePrice) * rule.value) / 100) : rule.value,
              });
            }
          }
        }

        if (input.purchaseCourseTemplateId) {
          const tpl = state.courseTemplates.find((x) => x.id === input.purchaseCourseTemplateId)!;
          items.push({ description: `${tpl.name} (${tpl.sessions} Sessions)`, qty: 1, amount: coursePrice, kind: "BASE" });
          subtotal += coursePrice;
          type = input.serviceId ? "MIXED" : "COURSE_PURCHASE";
          newPatientCourse = {
            id: `pc-live-${state.seq}`,
            patientId: input.patientId,
            courseId: tpl.id,
            purchaseDate: TODAY,
            expiryDate: addDaysStr(TODAY, tpl.expiryDays),
            purchased: tpl.sessions,
            bonus: tpl.bonusSessions,
            used: 0,
            transferIn: 0,
            transferOut: 0,
            branchId: input.branchId,
            status: "ACTIVE",
          };
          courseImpact.push({ label: `${tpl.name} — Purchase`, quantity: tpl.sessions });
          if (tpl.bonusSessions > 0) courseImpact.push({ label: `${tpl.name} — Bonus`, quantity: tpl.bonusSessions });
          patientCourseId = newPatientCourse.id;
          if (input.salespersonId) {
            const rule = findCommissionRule(state.commissionRules, "SALES", "COURSE", tpl.id, TODAY);
            if (rule) {
              commission.push({
                ruleId: rule.id, ruleName: rule.name, staffId: input.salespersonId, type: "SALES",
                amount: rule.commissionType === "PERCENTAGE" ? Math.round((commissionBase(coursePrice) * rule.value) / 100) : rule.value,
              });
            }
          }
        }

        set((s) => {
          if (newPatientCourse) {
            s.patientCourses.push(newPatientCourse!);
            s.courseLedger.push({
              id: `led-live-${s.seq}`, patientCourseId: newPatientCourse!.id, date: nowIso(),
              type: "PURCHASE", quantity: newPatientCourse!.purchased, balanceAfter: newPatientCourse!.purchased,
              branchId: input.branchId, relatedTransactionId: txnId, performedBy: actorName,
            });
            s.seq++;
            if (newPatientCourse!.bonus > 0) {
              s.courseLedger.push({
                id: `led-live-${s.seq}`, patientCourseId: newPatientCourse!.id, date: nowIso(),
                type: "BONUS", quantity: newPatientCourse!.bonus, balanceAfter: newPatientCourse!.purchased + newPatientCourse!.bonus,
                branchId: input.branchId, relatedTransactionId: txnId, performedBy: actorName,
              });
              s.seq++;
            }
          }

          const usePcId = input.useCoursePatientCourseId ?? (input.useNewlyPurchasedSession ? newPatientCourse?.id : undefined);
          if (usePcId) {
            const qty = input.useSessionsCount ?? 1;
            const pc = s.patientCourses.find((x) => x.id === usePcId);
            if (pc) {
              pc.used += qty;
              pc.status = computeStatus(pc);
              const bal = remaining(pc);
              const tpl = s.courseTemplates.find((x) => x.id === pc.courseId);
              s.courseLedger.push({
                id: `led-live-${s.seq}`, patientCourseId: pc.id, date: nowIso(), type: "TREATMENT",
                quantity: -qty, balanceAfter: bal, branchId: input.branchId, relatedTransactionId: txnId,
                performedBy: input.treatingStaffId
                  ? (s.staff.find((st) => st.id === input.treatingStaffId)?.name ?? actorName)
                  : actorName,
              });
              s.seq++;
              patientCourseId = pc.id;
              type = input.serviceId || input.purchaseCourseTemplateId ? "MIXED" : "COURSE_USAGE";
              courseImpact.push({ label: `${tpl?.name ?? "Course"} — Treatment`, quantity: -qty });
              if (input.treatingStaffId) {
                const rule = findCommissionRule(s.commissionRules, "TREATMENT", "COURSE", pc.courseId, TODAY);
                if (rule) {
                  commission.push({
                    ruleId: rule.id, ruleName: rule.name, staffId: input.treatingStaffId, type: "TREATMENT",
                    amount: rule.commissionType === "PERCENTAGE" ? Math.round((commissionBase(subtotal) * rule.value) / 100) : rule.value,
                  });
                }
              }
            }
          }

          if (newPatientCourse) {
            const pcInStore = s.patientCourses.find((p) => p.id === newPatientCourse!.id);
            if (pcInStore) pcInStore.status = computeStatus(pcInStore);
          }

          for (const adj of adjustments) {
            items.push({
              description: adj.label,
              qty: 1,
              amount: adj.amount,
              kind: adj.amount < 0 ? "DISCOUNT" : "SURCHARGE",
            });
          }

          const txn: Transaction = {
            id: txnId, transactionNo: txnNo, date: nowIso(), patientId: input.patientId,
            branchId: input.branchId, appointmentId: input.appointmentId, type, items, subtotal,
            total: netTotal, paymentMethodId: input.paymentMethodId,
            treatingStaffId: input.treatingStaffId, salespersonId: input.salespersonId,
            status: "COMPLETED", courseImpact, commission, patientCourseId,
          };
          s.transactions.unshift(txn);
          s.seq++;
          if (input.appointmentId) {
            const apt = s.appointments.find((a) => a.id === input.appointmentId);
            if (apt) apt.checkedOut = true;
          }
        });

        return get().transactions[0];
      },

      voidTransaction: (id, reason, actorName) => set((s) => {
        const txn = s.transactions.find((t) => t.id === id);
        if (!txn || txn.status === "VOID") return;
        txn.status = "VOID";
        txn.voidInfo = { voidBy: actorName, voidAt: nowIso(), reason };
        if (txn.patientCourseId) {
          const pc = s.patientCourses.find((p) => p.id === txn.patientCourseId);
          if (pc) {
            for (const impact of txn.courseImpact) {
              if (impact.quantity > 0) {
                if (impact.label.includes("Bonus")) pc.bonus -= impact.quantity;
                else pc.purchased -= impact.quantity;
              } else {
                pc.used += impact.quantity; // quantity negative, adding back reduces used
              }
              s.courseLedger.push({
                id: `led-live-${s.seq}`, patientCourseId: pc.id, date: nowIso(), type: "VOID_REVERSAL",
                quantity: -impact.quantity, balanceAfter: remaining(pc) - impact.quantity, branchId: txn.branchId,
                relatedTransactionId: txn.id, performedBy: actorName,
              });
              s.seq++;
            }
            pc.status = computeStatus(pc);
          }
        }
        if (txn.appointmentId) {
          const apt = s.appointments.find((a) => a.id === txn.appointmentId);
          if (apt) apt.checkedOut = false;
        }
      }),

      transferCourseSessions: (fromPatientCourseId, toPatientId, sessions, actorName) => {
        const state = get();
        const from = state.patientCourses.find((p) => p.id === fromPatientCourseId);
        if (!from) return { ok: false, error: "Source course not found" };
        if (remaining(from) < sessions) return { ok: false, error: "Insufficient remaining sessions" };
        set((s) => {
          const transferGroupId = `trf-${s.seq}`;
          s.seq++;
          const fromPc = s.patientCourses.find((p) => p.id === fromPatientCourseId)!;
          fromPc.transferOut += sessions;
          fromPc.status = computeStatus(fromPc);
          s.courseLedger.push({
            id: `led-live-${s.seq}`, patientCourseId: fromPc.id, date: nowIso(), type: "TRANSFER_OUT",
            quantity: -sessions, balanceAfter: remaining(fromPc), branchId: fromPc.branchId, performedBy: actorName,
            transferGroupId, transferCounterpartyPatientId: toPatientId,
          });
          s.seq++;

          let toPc = s.patientCourses.find((p) => p.patientId === toPatientId && p.courseId === fromPc.courseId && p.status === "ACTIVE");
          if (!toPc) {
            toPc = {
              id: `pc-live-${s.seq}`, patientId: toPatientId, courseId: fromPc.courseId,
              purchaseDate: TODAY, expiryDate: fromPc.expiryDate, purchased: 0, bonus: 0, used: 0,
              transferIn: sessions, transferOut: 0, branchId: fromPc.branchId, status: "ACTIVE",
            };
            s.patientCourses.push(toPc);
            s.seq++;
          } else {
            toPc.transferIn += sessions;
          }
          toPc.status = computeStatus(toPc);
          s.courseLedger.push({
            id: `led-live-${s.seq}`, patientCourseId: toPc.id, date: nowIso(), type: "TRANSFER_IN",
            quantity: sessions, balanceAfter: remaining(toPc), branchId: toPc.branchId, performedBy: actorName,
            transferGroupId, transferCounterpartyPatientId: fromPc.patientId,
          });
          s.seq++;
        });
        return { ok: true };
      },

      resetDemoData: () => set((s) => {
        Object.assign(s, initialState, { session: s.session });
      }),
    })),
    {
      name: "clinic-erp-store",
      version: 4,
      migrate: (persisted, version) => {
        // v3 collapsed four roles into two and rebuilt the staff/user seed data;
        // v4 renamed the MANAGER role to ADMIN. Anything older is discarded
        // rather than patched — an empty object merges over the fresh initial state.
        if (version < 4) return {} as ClinicState;
        const state = persisted as ClinicState;
        if (state?.session?.user && !VALID_ROLES.includes(state.session.user.role)) {
          state.session = { user: null, activeBranchId: null, accessToken: null };
        }
        return state;
      },
      onRehydrateStorage: () => (state) => {
        if (state?.session.user && !VALID_ROLES.includes(state.session.user.role)) {
          state.session = { user: null, activeBranchId: null, accessToken: null };
        }
        state?.setHasHydrated(true);
      },
      partialize: (s) => ({
        session: s.session,
        seq: s.seq,
        branches: s.branches,
        staff: s.staff,
        users: s.users,
        services: s.services,
        courseTemplates: s.courseTemplates,
        paymentMethods: s.paymentMethods,
        resources: s.resources,
        masterData: s.masterData,
        commissionRules: s.commissionRules,
        patients: s.patients,
        patientCourses: s.patientCourses,
        courseLedger: s.courseLedger,
        appointments: s.appointments,
        transactions: s.transactions,
      }),
    }
  )
);

export type { Role };
