import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  Appointment,
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

import * as api from "@/lib/api/clinic-api";
import { setTokenReader, setUnauthenticatedHandler } from "@/lib/api/client";

const VALID_ROLES: Role[] = ["ADMIN", "PHYSIOTHERAPIST"];

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
  /** True once the persisted session has been read back from storage. */
  hasHydrated: boolean;
  /** True once the clinic data has been loaded from the API at least once. */
  dataLoaded: boolean;
  loading: boolean;
  loadError: string | null;
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

  // session
  setAuthenticatedSession: (user: AppUser, accessToken: string) => void;
  logout: () => void;
  setActiveBranch: (branchId: string | null) => void;

  /** Loads every collection from the API. Safe to call repeatedly. */
  refresh: () => Promise<void>;
  /** Reloads only the parts a sale or a transfer can change. */
  refreshOperational: () => Promise<void>;

  // admin: branches
  addBranch: (data: Omit<Branch, "id">) => Promise<void>;
  updateBranch: (id: string, data: Partial<Branch>) => Promise<void>;
  toggleBranchStatus: (id: string) => Promise<void>;

  // admin: staff
  addStaff: (data: Omit<Staff, "id">, account: { role: Role; password: string }) => Promise<void>;
  updateStaff: (id: string, data: Partial<Staff>) => Promise<void>;
  toggleStaffStatus: (id: string) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;

  // admin: users
  updateUser: (id: string, data: Partial<AppUser>) => Promise<void>;
  toggleUserStatus: (id: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  // admin: services / courses
  addService: (data: Omit<Service, "id">) => Promise<void>;
  updateService: (id: string, data: Partial<Service>) => Promise<void>;
  toggleServiceStatus: (id: string) => Promise<void>;
  addCourseTemplate: (data: Omit<CourseTemplate, "id">) => Promise<void>;
  updateCourseTemplate: (id: string, data: Partial<CourseTemplate>) => Promise<void>;
  toggleCourseTemplateStatus: (id: string) => Promise<void>;

  // admin: payment methods
  togglePaymentMethod: (id: string) => Promise<void>;

  // admin: resources
  addResource: (data: Omit<ResourceRoom, "id">) => Promise<void>;
  updateResource: (id: string, data: Partial<ResourceRoom>) => Promise<void>;
  toggleResourceStatus: (id: string) => Promise<void>;

  // admin: commission rules
  addCommissionRule: (data: Omit<CommissionRule, "id">) => Promise<void>;
  updateCommissionRule: (id: string, data: Partial<CommissionRule>) => Promise<void>;
  toggleCommissionRuleStatus: (id: string) => Promise<void>;

  // admin: master data
  addMasterDataItem: (data: Omit<MasterDataItem, "id">) => Promise<void>;
  updateMasterDataItem: (id: string, data: Partial<MasterDataItem>) => Promise<void>;
  toggleMasterDataItemStatus: (id: string) => Promise<void>;

  // patients
  addPatient: (data: Omit<Patient, "id" | "hn" | "createdAt">) => Promise<Patient>;
  updatePatient: (id: string, data: Partial<Patient>) => Promise<void>;

  // appointments
  checkConflict: (input: NewAppointmentInput, excludeId?: string) => string | null;
  addAppointment: (
    input: NewAppointmentInput
  ) => Promise<{ ok: boolean; error?: string; appointment?: Appointment }>;
  checkInAppointment: (id: string) => Promise<void>;
  startService: (id: string) => Promise<void>;
  completeService: (id: string) => Promise<void>;
  cancelAppointment: (id: string, reason: string) => Promise<void>;
  markNoShow: (id: string) => Promise<void>;
  rescheduleAppointment: (
    id: string,
    date: string,
    startTime: string,
    endTime: string,
    reason?: string
  ) => Promise<Appointment | null>;

  // checkout / transactions
  createTransaction: (input: CheckoutInput) => Promise<Transaction>;
  voidTransaction: (id: string, reason: string) => Promise<void>;

  // course transfer (staff-executed)
  transferCourseSessions: (
    fromPatientCourseId: string,
    toPatientId: string,
    sessions: number
  ) => Promise<{ ok: boolean; error?: string }>;
}

const emptyData = {
  branches: [] as Branch[],
  staff: [] as Staff[],
  users: [] as AppUser[],
  services: [] as Service[],
  courseTemplates: [] as CourseTemplate[],
  paymentMethods: [] as PaymentMethod[],
  resources: [] as ResourceRoom[],
  masterData: [] as MasterDataItem[],
  commissionRules: [] as CommissionRule[],
  patients: [] as Patient[],
  patientCourses: [] as PatientCourse[],
  courseLedger: [] as CourseLedgerEntry[],
  appointments: [] as Appointment[],
  transactions: [] as Transaction[],
};

/** Replaces the matching row, or appends it when the id is new. */
function upsert<T extends { id: string }>(list: T[], item: T) {
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index >= 0) list[index] = item;
  else list.push(item);
}

function requireItem<T>(item: T | undefined, label: string): T {
  if (!item) throw new Error(`${label} no longer exists. Refresh and try again.`);
  return item;
}

export const useClinicStore = create<ClinicState>()(
  persist(
    immer((set, get) => ({
      session: { user: null, activeBranchId: null, accessToken: null } as Session,
      hasHydrated: false,
      dataLoaded: false,
      loading: false,
      loadError: null,
      ...emptyData,

      setHasHydrated: (v) =>
        set((s) => {
          s.hasHydrated = v;
        }),

      setAuthenticatedSession: (user, accessToken) =>
        set((s) => {
          s.session.user = user;
          s.session.accessToken = accessToken;
          s.session.activeBranchId = null;
          // A fresh sign-in starts clean: a failure recorded against the
          // previous session must not keep the next one from loading.
          s.dataLoaded = false;
          s.loading = false;
          s.loadError = null;
          Object.assign(s, emptyData);
        }),

      logout: () =>
        set((s) => {
          s.session = { user: null, activeBranchId: null, accessToken: null };
          s.dataLoaded = false;
          s.loadError = null;
          Object.assign(s, emptyData);
        }),

      setActiveBranch: (branchId) =>
        set((s) => {
          s.session.activeBranchId = branchId;
        }),

      refresh: async () => {
        const { session } = get();
        if (!session.accessToken || !session.user) return;
        set((s) => {
          s.loading = true;
          s.loadError = null;
        });
        try {
          // The saved token may be older than the account behind it, so the
          // profile is re-read before anything is loaded with it.
          const profile = await api.me();
          const role: Role = profile.roles.includes("ADMIN") ? "ADMIN" : "PHYSIOTHERAPIST";
          const snapshot = await api.loadSnapshot(role === "ADMIN");

          set((s) => {
            Object.assign(s, snapshot);
            s.dataLoaded = true;
            s.loading = false;

            const active = snapshot.branches.filter((b) => b.status === "ACTIVE");
            // An admin stands at any branch; everyone else is limited to the
            // branches their account is assigned to.
            const assigned = (profile.branchIds ?? []).map(String);
            const allowed =
              role === "ADMIN" || assigned.length === 0
                ? active.map((b) => b.id)
                : assigned.filter((id) => active.some((b) => b.id === id));

            s.session.user = {
              id: String(profile.id),
              username: profile.email,
              password: "",
              role,
              staffId: profile.staffId == null ? undefined : String(profile.staffId),
              displayName:
                `${profile.firstName} ${profile.lastName}`.trim() || profile.email,
              branchIds: allowed,
              status: profile.active ? "ACTIVE" : "INACTIVE",
              lastLogin: s.session.user?.lastLogin,
            };
            if (!s.session.activeBranchId || !allowed.includes(s.session.activeBranchId)) {
              s.session.activeBranchId = allowed[0] ?? null;
            }
          });
        } catch (error) {
          // A rejected token has already signed the user out and the app is on
          // its way to the sign-in screen, so there is no failure to report.
          const signedOut = !get().session.accessToken;
          set((s) => {
            s.loading = false;
            s.loadError = signedOut
              ? null
              : error instanceof Error
                ? error.message
                : "Unable to load clinic data";
          });
        }
      },

      refreshOperational: async () => {
        const [courses, appointments, transactions] = await Promise.all([
          api.listPatientCourses(),
          api.listAppointments(),
          api.listTransactions(),
        ]);
        set((s) => {
          s.patientCourses = courses.patientCourses;
          s.courseLedger = courses.courseLedger;
          s.appointments = appointments;
          s.transactions = transactions;
        });
      },

      // ------------------------------------------------------------ branches

      addBranch: async (data) => {
        const branch = await api.createBranch(data);
        set((s) => {
          upsert(s.branches, branch);
        });
      },

      updateBranch: async (id, data) => {
        const current = requireItem(get().branches.find((b) => b.id === id), "This branch");
        const branch = await api.updateBranch({ ...current, ...data, id });
        set((s) => {
          upsert(s.branches, branch);
        });
      },

      toggleBranchStatus: async (id) => {
        const current = requireItem(get().branches.find((b) => b.id === id), "This branch");
        const branch = await api.setBranchActive(id, current.status !== "ACTIVE");
        set((s) => {
          upsert(s.branches, branch);
        });
      },

      // --------------------------------------------------------------- staff

      addStaff: async (data, account) => {
        await api.createStaff(data, account);
        const [staff, users] = await Promise.all([
          api.listStaff(),
          get().session.user?.role === "ADMIN" ? api.listUsers().catch(() => []) : Promise.resolve([]),
        ]);
        set((s) => {
          s.staff = staff;
          if (users.length) s.users = users;
        });
      },

      updateStaff: async (id, data) => {
        const current = requireItem(get().staff.find((x) => x.id === id), "This staff member");
        const merged = { ...current, ...data };
        const staff = await api.updateStaff(id, merged);
        set((s) => {
          upsert(s.staff, staff);
          const account = s.users.find((u) => u.staffId === id);
          if (account) account.status = staff.status;
        });
      },

      toggleStaffStatus: async (id) => {
        const current = requireItem(get().staff.find((x) => x.id === id), "This staff member");
        await get().updateStaff(id, {
          status: current.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        });
      },

      deleteStaff: async (id) => {
        await api.deleteStaff(id);
        set((s) => {
          s.staff = s.staff.filter((x) => x.id !== id);
          s.users = s.users.filter((u) => u.staffId !== id);
        });
      },

      // --------------------------------------------------------------- users

      updateUser: async (id, data) => {
        const user = await api.updateUser(id, {
          role: data.role,
          active: data.status ? data.status === "ACTIVE" : undefined,
        });
        const withBranches = data.branchIds ? await api.setUserBranches(id, data.branchIds) : user;
        set((s) => {
          upsert(s.users, withBranches);
        });
      },

      toggleUserStatus: async (id) => {
        const current = requireItem(get().users.find((u) => u.id === id), "This account");
        await get().updateUser(id, {
          status: current.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        });
      },

      deleteUser: async (id) => {
        await api.deleteUser(id);
        set((s) => {
          const removed = s.users.find((u) => u.id === id);
          s.users = s.users.filter((u) => u.id !== id);
          if (removed?.staffId) s.staff = s.staff.filter((x) => x.id !== removed.staffId);
        });
      },

      // ---------------------------------------------------- services/courses

      addService: async (data) => {
        const service = await api.createService(data);
        set((s) => {
          upsert(s.services, service);
        });
      },

      updateService: async (id, data) => {
        const current = requireItem(get().services.find((x) => x.id === id), "This service");
        const service = await api.updateService(id, { ...current, ...data });
        set((s) => {
          upsert(s.services, service);
        });
      },

      toggleServiceStatus: async (id) => {
        const current = requireItem(get().services.find((x) => x.id === id), "This service");
        const service = await api.setServiceActive(id, current.status !== "ACTIVE");
        set((s) => {
          upsert(s.services, service);
        });
      },

      addCourseTemplate: async (data) => {
        const course = await api.createCourseTemplate(data);
        set((s) => {
          upsert(s.courseTemplates, course);
        });
      },

      updateCourseTemplate: async (id, data) => {
        const current = requireItem(
          get().courseTemplates.find((x) => x.id === id),
          "This course"
        );
        const course = await api.updateCourseTemplate(id, { ...current, ...data });
        set((s) => {
          upsert(s.courseTemplates, course);
        });
      },

      toggleCourseTemplateStatus: async (id) => {
        const current = requireItem(
          get().courseTemplates.find((x) => x.id === id),
          "This course"
        );
        const course = await api.setCourseTemplateActive(id, current.status !== "ACTIVE");
        set((s) => {
          upsert(s.courseTemplates, course);
        });
      },

      // ----------------------------------------------------- payment methods

      togglePaymentMethod: async (id) => {
        const current = requireItem(
          get().paymentMethods.find((x) => x.id === id),
          "This payment method"
        );
        const method = await api.setPaymentMethodEnabled(id, !current.enabled);
        set((s) => {
          upsert(s.paymentMethods, method);
        });
      },

      // ----------------------------------------------------------- resources

      addResource: async (data) => {
        const resource = await api.createResource(data);
        set((s) => {
          upsert(s.resources, resource);
        });
      },

      updateResource: async (id, data) => {
        const current = requireItem(get().resources.find((x) => x.id === id), "This resource");
        const resource = await api.updateResource(id, { ...current, ...data });
        set((s) => {
          upsert(s.resources, resource);
        });
      },

      toggleResourceStatus: async (id) => {
        const current = requireItem(get().resources.find((x) => x.id === id), "This resource");
        const resource = await api.setResourceActive(id, current.status !== "ACTIVE");
        set((s) => {
          upsert(s.resources, resource);
        });
      },

      // ---------------------------------------------------- commission rules

      addCommissionRule: async (data) => {
        const rule = await api.createCommissionRule(data);
        set((s) => {
          upsert(s.commissionRules, rule);
        });
      },

      updateCommissionRule: async (id, data) => {
        const current = requireItem(
          get().commissionRules.find((x) => x.id === id),
          "This commission rule"
        );
        const rule = await api.updateCommissionRule(id, { ...current, ...data });
        set((s) => {
          upsert(s.commissionRules, rule);
        });
      },

      toggleCommissionRuleStatus: async (id) => {
        const current = requireItem(
          get().commissionRules.find((x) => x.id === id),
          "This commission rule"
        );
        const rule = await api.setCommissionRuleActive(id, current.status !== "ACTIVE");
        set((s) => {
          upsert(s.commissionRules, rule);
        });
      },

      // --------------------------------------------------------- master data

      addMasterDataItem: async (data) => {
        const item = await api.createMasterDataItem(data);
        set((s) => {
          upsert(s.masterData, item);
        });
      },

      updateMasterDataItem: async (id, data) => {
        const item = await api.updateMasterDataItem(id, data);
        set((s) => {
          upsert(s.masterData, item);
        });
      },

      toggleMasterDataItemStatus: async (id) => {
        const current = requireItem(get().masterData.find((x) => x.id === id), "This value");
        const item = await api.setMasterDataActive(id, current.status !== "ACTIVE");
        set((s) => {
          upsert(s.masterData, item);
        });
      },

      // ------------------------------------------------------------ patients

      addPatient: async (data) => {
        const patient = await api.createPatient(data);
        set((s) => {
          s.patients.unshift(patient);
        });
        return patient;
      },

      updatePatient: async (id, data) => {
        const current = requireItem(get().patients.find((p) => p.id === id), "This patient");
        const patient = await api.updatePatient(id, { ...current, ...data });
        set((s) => {
          upsert(s.patients, patient);
        });
      },

      // -------------------------------------------------------- appointments

      /**
       * A local pre-check so the form can warn before it posts. The API repeats
       * the same check inside the transaction, which is what actually protects
       * the slot against a second person booking at the same moment.
       */
      checkConflict: (input, excludeId) => {
        const { appointments } = get();
        const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
          aStart < bEnd && bStart < aEnd;
        const blocking = ["CONFIRMED", "ARRIVED", "IN_SERVICE", "COMPLETED"];
        for (const appointment of appointments) {
          if (appointment.id === excludeId) continue;
          if (appointment.date !== input.date) continue;
          if (!blocking.includes(appointment.status)) continue;
          if (
            !overlaps(input.startTime, input.endTime, appointment.startTime, appointment.endTime)
          )
            continue;
          if (appointment.physiotherapistId === input.physiotherapistId)
            return "Physiotherapist already has an appointment at this time.";
          if (input.resourceId && appointment.resourceId === input.resourceId)
            return "This treatment room is unavailable at this time.";
        }
        return null;
      },

      addAppointment: async (input) => {
        const conflict = get().checkConflict(input);
        if (conflict) return { ok: false, error: conflict };
        try {
          const appointment = await api.createAppointment(input);
          set((s) => {
            upsert(s.appointments, appointment);
          });
          return { ok: true, appointment };
        } catch (error) {
          return {
            ok: false,
            error: error instanceof Error ? error.message : "Unable to book this appointment",
          };
        }
      },

      checkInAppointment: async (id) => {
        const appointment = await api.transitionAppointment(id, "arrive");
        set((s) => {
          upsert(s.appointments, appointment);
        });
      },

      startService: async (id) => {
        const appointment = await api.transitionAppointment(id, "start");
        set((s) => {
          upsert(s.appointments, appointment);
        });
      },

      completeService: async (id) => {
        const appointment = await api.transitionAppointment(id, "complete");
        set((s) => {
          upsert(s.appointments, appointment);
        });
      },

      cancelAppointment: async (id, reason) => {
        const appointment = await api.transitionAppointment(id, "cancel", reason);
        set((s) => {
          upsert(s.appointments, appointment);
        });
      },

      markNoShow: async (id) => {
        const appointment = await api.transitionAppointment(id, "noshow");
        set((s) => {
          upsert(s.appointments, appointment);
        });
      },

      rescheduleAppointment: async (id, date, startTime, endTime, reason) => {
        const moved = await api.rescheduleAppointment(id, date, startTime, endTime, reason);
        // The original is now RESCHEDULED, so both rows are re-read together.
        const appointments = await api.listAppointments();
        set((s) => {
          s.appointments = appointments;
        });
        return moved;
      },

      // --------------------------------------------------- checkout / voids

      createTransaction: async (input) => {
        const transaction = await api.checkout(input);
        // A sale can create a course, spend a session and close an appointment,
        // so the operational collections are re-read rather than patched.
        await get().refreshOperational();
        set((s) => {
          upsert(s.transactions, transaction);
        });
        return transaction;
      },

      voidTransaction: async (id, reason) => {
        const transaction = await api.voidTransaction(id, reason);
        await get().refreshOperational();
        set((s) => {
          upsert(s.transactions, transaction);
        });
      },

      // ------------------------------------------------------ course transfer

      transferCourseSessions: async (fromPatientCourseId, toPatientId, sessions) => {
        try {
          await api.transferCourseSessions(fromPatientCourseId, toPatientId, sessions);
          const courses = await api.listPatientCourses();
          set((s) => {
            s.patientCourses = courses.patientCourses;
            s.courseLedger = courses.courseLedger;
          });
          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            error: error instanceof Error ? error.message : "Unable to transfer these sessions",
          };
        }
      },
    })),
    {
      name: "clinic-erp-store",
      version: 5,
      // Clinic data lives on the server now; only the session is worth keeping
      // between page loads.
      partialize: (s) => ({ session: s.session }),
      migrate: (persisted, version) => {
        // Versions below 5 persisted a whole mock database. Dropping it is the
        // migration: everything is re-read from the API on the next load.
        if (version < 5) return {} as ClinicState;
        return persisted as ClinicState;
      },
      onRehydrateStorage: () => (state) => {
        if (state?.session.user && !VALID_ROLES.includes(state.session.user.role)) {
          state.session = { user: null, activeBranchId: null, accessToken: null };
        }
        state?.setHasHydrated(true);
      },
    }
  )
);

// The API reads the token straight out of the live store, so every request uses
// the current session without any screen having to pass it along.
setTokenReader(() => useClinicStore.getState().session.accessToken);
setUnauthenticatedHandler(() => useClinicStore.getState().logout());

export type { Role };
