/**
 * Translation between the API's wire shapes and the domain types the screens
 * use. Ids stay strings on this side of the wire, exactly as the UI expects.
 */
import type {
  Appointment,
  AppointmentStatus,
  AppUser,
  Branch,
  ClosingHistoryRow,
  ClosingPreviewRow,
  CommissionRule,
  CommissionScheme,
  CourseCommissionReportRow,
  CourseLedgerEntry,
  CourseTemplate,
  CustomerType,
  Gender,
  LedgerEntryType,
  MasterDataItem,
  Patient,
  PatientCourse,
  PaymentMethod,
  ResourceRoom,
  Role,
  Service,
  ServiceType,
  SharedCourseMember,
  Staff,
  StaffPosition,
  Transaction,
  TreatmentFeeRule,
} from "@/types";

type Row = Record<string, unknown>;

const str = (value: unknown): string => (value == null ? "" : String(value));
const num = (value: unknown): number => (value == null ? 0 : Number(value));
const id = (value: unknown): string => (value == null ? "" : String(value));
const bool = (value: unknown): boolean => value === true || value === "true";
const status = (active: unknown): "ACTIVE" | "INACTIVE" => (bool(active) ? "ACTIVE" : "INACTIVE");

/** Backend role codes are ADMIN and PHYSIO; the UI speaks in full job titles. */
export function toRole(code: unknown): Role {
  return str(code) === "ADMIN" ? "ADMIN" : "PHYSIOTHERAPIST";
}

export function toRoleCode(role: Role): string {
  return role === "ADMIN" ? "ADMIN" : "PHYSIOTHERAPIST";
}

// -------------------------------------------------------------------- branches

export function toBranch(row: Row): Branch {
  return {
    id: id(row.id),
    code: str(row.code).trim(),
    name: str(row.name),
    phone: str(row.phone),
    address: str(row.address),
    status: status(row.active),
  };
}

// ----------------------------------------------------------------------- staff

const POSITIONS: StaffPosition[] = [
  "Physiotherapist",
  "Clinic Manager",
  "Assistant Therapist",
  "Salesperson",
];

export function toStaff(row: Row): Staff {
  const position = str(row.position) as StaffPosition;
  return {
    id: id(row.id),
    name: str(row.name),
    nameEn: str(row.nameEn),
    position: POSITIONS.includes(position) ? position : "Physiotherapist",
    branchIds: parseIdList(row.branchIds),
    phone: str(row.phone),
    email: str(row.email),
    status: str(row.status) === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    avatarColor: str(row.avatarColor) || "bg-[#1A4A2E]",
    commissionEligible: row.commissionEligible == null ? undefined : bool(row.commissionEligible),
    terminationDate: row.terminationDate == null ? undefined : str(row.terminationDate).slice(0, 10),
    commissionAfterTerminationPolicy:
      row.commissionAfterTerminationPolicy == null ? undefined : str(row.commissionAfterTerminationPolicy),
  };
}

export function toUser(row: Row): AppUser {
  return {
    id: id(row.id),
    username: str(row.email),
    password: "",
    role: toRole(row.role_code),
    staffId: row.staff_id == null ? undefined : id(row.staff_id),
    displayName: `${str(row.first_name)} ${str(row.last_name)}`.trim() || str(row.email),
    branchIds: str(row.branch_ids).split(",").filter(Boolean),
    status: bool(row.active) ? "ACTIVE" : "INACTIVE",
    lastLogin: row.last_login == null ? undefined : new Date(str(row.last_login)).toISOString(),
  };
}

/** Staff branch ids are stored as a JSON array in a text column. */
function parseIdList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(id);
  const raw = str(value);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(id) : [];
  } catch {
    return raw.split(",").map((part) => part.trim()).filter(Boolean);
  }
}

export const toBranchIdsJson = (branchIds: string[]) => JSON.stringify(branchIds);

// ------------------------------------------------------------------- catalogue

export function toService(row: Row): Service {
  const type = str(row.service_type) as ServiceType;
  return {
    id: id(row.id),
    code: str(row.code).trim(),
    name: str(row.name_th),
    type: type === "ASSESSMENT" ? "ASSESSMENT" : "SINGLE_VISIT",
    price: num(row.base_price),
    duration: num(row.duration_minutes),
    status: status(row.active),
  };
}

export function toCourseTemplate(row: Row): CourseTemplate {
  return {
    id: id(row.id),
    code: str(row.code).trim(),
    name: str(row.name_th),
    description: str(row.description),
    price: num(row.price),
    sessions: num(row.total_sessions),
    bonusSessions: num(row.bonus_sessions),
    expiryDays: num(row.validity_days),
    status: status(row.active),
  };
}

export function toPaymentMethod(row: Row): PaymentMethod {
  return {
    id: id(row.id),
    code: str(row.code).trim().toUpperCase(),
    name: str(row.name),
    icon: str(row.icon) || "Wallet",
    enabled: bool(row.active),
  };
}

export function toResource(row: Row): ResourceRoom {
  return {
    id: id(row.id),
    name: str(row.name),
    type: str(row.room_type),
    branchId: id(row.branch_id),
    status: status(row.active),
  };
}

export function toMasterDataItem(row: Row): MasterDataItem {
  return {
    id: id(row.id),
    category: str(row.data_type) as MasterDataItem["category"],
    value: str(row.name_th),
    status: status(row.active),
  };
}

export function toCommissionRule(row: Row): CommissionRule {
  const targetType = str(row.target_type) as CommissionRule["targetType"];
  const targetId =
    targetType === "SERVICE"
      ? row.target_service_id
      : targetType === "COURSE"
        ? row.target_course_id
        : null;
  return {
    id: id(row.id),
    name: str(row.name),
    appliesTo: str(row.applies_to) as CommissionRule["appliesTo"],
    targetType,
    targetId: targetId == null ? undefined : id(targetId),
    commissionType: str(row.commission_type) as CommissionRule["commissionType"],
    value: num(row.value),
    effectiveDate: str(row.effective_date).slice(0, 10),
    status: status(row.active),
  };
}

// -------------------------------------------------------------------- patients

const GENDERS: Gender[] = ["MALE", "FEMALE", "OTHER"];

export function toPatient(row: Row): Patient {
  const gender = str(row.gender_code).toUpperCase() as Gender;
  const customerType = str(row.customer_type).toUpperCase() as CustomerType;
  return {
    id: id(row.id),
    hn: str(row.hn),
    customerType: customerType === "FOREIGNER" ? "FOREIGNER" : "THAI",
    titleTh: str(row.prefix),
    firstNameTh: str(row.first_name_th),
    lastNameTh: str(row.last_name_th),
    firstNameEn: str(row.first_name_en),
    lastNameEn: str(row.last_name_en),
    nickname: str(row.nickname),
    gender: GENDERS.includes(gender) ? gender : "OTHER",
    dob: str(row.birth_date).slice(0, 10),
    bloodGroup: str(row.blood_group_code),
    nationality: str(row.nationality_code),
    nationalId: row.national_id == null ? undefined : str(row.national_id),
    passport: row.passport_no == null ? undefined : str(row.passport_no),
    phone: str(row.phone),
    address: str(row.address_text),
    customerGroup: str(row.customer_group_code),
    referralChannel: str(row.referral_channel_code),
    insuranceCompany: str(row.insurance_company_code),
    registrationBranchId: id(row.registered_branch_id),
    createdAt: str(row.registered_at).slice(0, 10),
  };
}

export function toPatientRequest(patient: Omit<Patient, "id" | "hn" | "createdAt">) {
  return {
    customerType: patient.customerType,
    prefix: patient.titleTh,
    firstNameTh: patient.firstNameTh,
    lastNameTh: patient.lastNameTh,
    firstNameEn: patient.firstNameEn || null,
    lastNameEn: patient.lastNameEn || null,
    nickname: patient.nickname || null,
    genderCode: patient.gender,
    nationalId: patient.nationalId || null,
    passportNo: patient.passport || null,
    birthDate: patient.dob || null,
    bloodGroupCode: patient.bloodGroup || null,
    nationalityCode: patient.nationality || null,
    phone: patient.phone,
    email: null,
    addressText: patient.address ?? "",
    customerGroupCode: patient.customerGroup || null,
    referralChannelCode: patient.referralChannel || null,
    insuranceCompanyCode: patient.insuranceCompany || null,
    registeredBranchId: Number(patient.registrationBranchId),
  };
}

// ---------------------------------------------------------------- appointments

/**
 * The API works in absolute instants; the calendar works in the clinic's local
 * date and time. The conversion happens here and nowhere else.
 */
export function toAppointment(row: Row): Appointment {
  const start = new Date(str(row.starts_at));
  const end = new Date(str(row.ends_at));
  return {
    id: id(row.id),
    patientId: id(row.patient_id),
    date: localDate(start),
    startTime: localTime(start),
    endTime: localTime(end),
    branchId: id(row.branch_id),
    physiotherapistId: id(row.provider_staff_id),
    serviceId: id(row.service_id),
    resourceId: row.room_id == null ? "" : id(row.room_id),
    note: row.patient_note == null ? undefined : str(row.patient_note),
    status: str(row.status) as AppointmentStatus,
    createdAt: row.created_at == null ? "" : new Date(str(row.created_at)).toISOString(),
    checkedOut: bool(row.checked_out),
  };
}

export function localDate(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function localTime(value: Date): string {
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/** "2026-09-02" + "14:30" as an instant in the browser's own zone. */
export function toInstant(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// -------------------------------------------------------- courses and ledger

export function toPatientCourse(row: Row): PatientCourse {
  const purchased = num(row.total_visits);
  const bonus = num(row.bonus_visits);
  const used = num(row.visits_used);
  const transferIn = num(row.transfer_in_visits);
  const transferOut = num(row.transfer_out_visits);
  return {
    id: id(row.id),
    patientId: id(row.patient_id),
    courseId: id(row.package_id),
    purchaseDate: str(row.sale_date).slice(0, 10),
    expiryDate: str(row.valid_until).slice(0, 10),
    purchased,
    bonus,
    used,
    transferIn,
    transferOut,
    branchId: row.branch_id == null ? "" : id(row.branch_id),
    status: toCourseStatus(str(row.status)),
  };
}

function toCourseStatus(value: string): PatientCourse["status"] {
  if (value === "EXPIRED") return "EXPIRED";
  if (value === "USED_UP" || value === "REFUNDED") return "USED_UP";
  return "ACTIVE";
}

export function toLedgerEntry(row: Row): CourseLedgerEntry {
  return {
    id: id(row.id),
    patientCourseId: id(row.patient_course_id),
    date: new Date(str(row.created_at)).toISOString(),
    type: str(row.entry_type) as LedgerEntryType,
    quantity: num(row.quantity),
    balanceAfter: num(row.balance_after),
    branchId: row.branch_id == null ? "" : id(row.branch_id),
    relatedTransactionId:
      row.related_transaction_id == null ? undefined : id(row.related_transaction_id),
    transferGroupId: row.transfer_group_id == null ? undefined : str(row.transfer_group_id),
    transferCounterpartyPatientId:
      row.counterparty_patient_id == null ? undefined : id(row.counterparty_patient_id),
    performedBy: str(row.performed_by_name),
  };
}

// ---------------------------------------------------------------- transactions

export function toTransaction(row: Row): Transaction {
  const items = (row.items as Row[] | undefined) ?? [];
  const commission = (row.commission as Row[] | undefined) ?? [];
  const courseImpact = (row.courseImpact as Row[] | undefined) ?? [];
  const voidInfo = row.voidInfo as Row | null | undefined;

  return {
    id: id(row.id),
    transactionNo: str(row.transactionNo),
    date: str(row.date),
    patientId: id(row.patientId),
    branchId: id(row.branchId),
    appointmentId: row.appointmentId == null ? undefined : id(row.appointmentId),
    type: str(row.type) as Transaction["type"],
    items: items.map((item) => ({
      description: str(item.description),
      qty: num(item.qty),
      amount: num(item.amount),
      kind: str(item.kind) as Transaction["items"][number]["kind"],
    })),
    subtotal: num(row.subtotal),
    total: num(row.total),
    paymentMethodId: row.paymentMethodId == null ? "" : id(row.paymentMethodId),
    cashReceived: row.cashReceived == null ? undefined : num(row.cashReceived),
    changeGiven: row.changeGiven == null ? undefined : num(row.changeGiven),
    treatingStaffId: row.treatingStaffId == null ? undefined : id(row.treatingStaffId),
    salespersonId: row.salespersonId == null ? undefined : id(row.salespersonId),
    status: str(row.status) === "VOID" ? "VOID" : "COMPLETED",
    courseImpact: courseImpact.map((impact) => ({
      label: str(impact.label),
      quantity: num(impact.quantity),
    })),
    commission: commission.map((line) => ({
      ruleId: line.ruleId == null ? "" : id(line.ruleId),
      ruleName: str(line.ruleName),
      staffId: id(line.staffId),
      type: str(line.type) as "TREATMENT" | "SALES",
      amount: num(line.amount),
    })),
    patientCourseId: row.patientCourseId == null ? undefined : id(row.patientCourseId),
    voidInfo: voidInfo
      ? {
          voidBy: str(voidInfo.voidBy),
          voidAt: str(voidInfo.voidAt),
          reason: str(voidInfo.reason),
        }
      : undefined,
  };
}

// ---------------------------------------------------------- course commission
// The rows below come from JdbcTemplate query results (snake_case column
// names, unlike the camelCase Jackson records above) except where noted.

/** Groups the flat tier-per-row settings response by scheme code+version. */
export function toCommissionSchemes(rows: Row[]): CommissionScheme[] {
  const byKey = new Map<string, CommissionScheme>();
  for (const row of rows) {
    const key = `${str(row.code)}::${num(row.version)}`;
    let scheme = byKey.get(key);
    if (!scheme) {
      scheme = {
        code: str(row.code),
        version: num(row.version),
        effectiveFrom: str(row.effective_from).slice(0, 10),
        effectiveTo: row.effective_to == null ? null : str(row.effective_to).slice(0, 10),
        tiers: [],
      };
      byKey.set(key, scheme);
    }
    scheme.tiers.push({
      order: num(row.tier_order),
      min: num(row.minimum_monthly_sales),
      max: row.maximum_monthly_sales == null ? null : num(row.maximum_monthly_sales),
      rate: num(row.commission_rate),
    });
  }
  return [...byKey.values()];
}

/** From MonthlyCommissionClosingService.EmployeePreview — a Jackson record, camelCase. */
export function toClosingPreviewRow(row: Row): ClosingPreviewRow {
  return {
    employeeId: id(row.employeeId),
    employeeName: str(row.employeeName),
    monthlySales: num(row.monthlySales),
    schemeId: row.schemeId == null ? null : id(row.schemeId),
    schemeVersion: row.schemeVersion == null ? null : num(row.schemeVersion),
    suggestedRate: num(row.suggestedRate),
    suggestedPool: num(row.suggestedPool),
    alreadyClosed: bool(row.alreadyClosed),
  };
}

export function toClosingHistoryRow(row: Row): ClosingHistoryRow {
  return {
    id: id(row.id),
    closingMonth: str(row.closing_month).slice(0, 10),
    employeeId: id(row.employee_id),
    employeeName: str(row.employee_name),
    monthlyCourseSales: num(row.monthly_course_sales),
    lockedCommissionRate: num(row.locked_commission_rate),
    status: str(row.status),
    closedAt: row.closed_at == null ? null : str(row.closed_at),
  };
}

/** From CommissionQueryService.ReportRow — a Jackson record, camelCase. */
export function toCourseCommissionReportRow(row: Row): CourseCommissionReportRow {
  return {
    staffId: id(row.staffId),
    staffName: str(row.staffName),
    monthlyCourseSales: num(row.monthlyCourseSales),
    commissionGenerated: num(row.commissionGenerated),
    grossAllocated: num(row.grossAllocated),
    ownerNetReleased: num(row.ownerNetReleased),
    treatmentFeeEarned: num(row.treatmentFeeEarned),
    adjustments: num(row.adjustments),
    outstandingPool: num(row.outstandingPool),
    totalVariablePay: num(row.totalVariablePay),
  };
}

export function toTreatmentFeeRule(row: Row): TreatmentFeeRule {
  return {
    id: id(row.id),
    employeeId: row.employee_id == null ? undefined : id(row.employee_id),
    employeeGroup: row.employee_group == null ? undefined : str(row.employee_group),
    serviceId: row.service_id == null ? undefined : id(row.service_id),
    feeType: str(row.fee_type) as TreatmentFeeRule["feeType"],
    feeValue: num(row.fee_value),
    percentageBase: row.percentage_base == null ? undefined : str(row.percentage_base),
    effectiveFrom: str(row.effective_from).slice(0, 10),
    effectiveTo: row.effective_to == null ? undefined : str(row.effective_to).slice(0, 10),
    active: bool(row.active),
  };
}

export function toSharedCourseMember(row: Row): SharedCourseMember {
  return {
    patientId: id(row.patient_id),
    role: str(row.role) as SharedCourseMember["role"],
    status: str(row.status),
    allocatedVisits: num(row.allocated_visits),
    usedVisits: num(row.used_visits),
  };
}
