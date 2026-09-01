// Core domain types for the Clinic ERP mock-up

// The clinic is staff-operated and runs on two access levels only.
export type Role = "ADMIN" | "PHYSIOTHERAPIST";

export type Permission =
  | "patient.view"
  | "patient.create"
  | "patient.edit"
  | "appointment.view"
  | "appointment.create"
  | "appointment.edit"
  | "appointment.cancel"
  | "checkout.create"
  | "course.view"
  | "course.use"
  | "course.transfer"
  | "transaction.view"
  | "transaction.void"
  | "report.view"
  | "dashboard.view"
  | "commission.view.own"
  | "commission.view.all"
  | "report.view.all"
  | "settings.manage";

export interface Branch {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  status: "ACTIVE" | "INACTIVE";
}

export type StaffPosition =
  | "Physiotherapist"
  | "Clinic Manager"
  | "Assistant Therapist";

export interface Staff {
  id: string;
  name: string; // Thai
  nameEn: string;
  position: StaffPosition;
  branchIds: string[];
  phone: string;
  email: string;
  status: "ACTIVE" | "INACTIVE";
  avatarColor: string;
  deletedAt?: string;
}

export interface AppUser {
  id: string;
  username: string;
  password: string;
  role: Role;
  staffId?: string;
  displayName: string;
  branchIds: string[]; // accessible branches (staff)
  status: "ACTIVE" | "INACTIVE";
  lastLogin?: string;
  deletedAt?: string;
}

export type Gender = "MALE" | "FEMALE" | "OTHER";
export type CustomerType = "THAI" | "FOREIGNER";

export interface Patient {
  id: string;
  hn: string;
  customerType: CustomerType;
  titleTh: string;
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn: string;
  lastNameEn: string;
  nickname: string;
  gender: Gender;
  dob: string;
  bloodGroup: string;
  nationality: string;
  nationalId?: string;
  passport?: string;
  phone: string;
  address: string;
  customerGroup: string;
  referralChannel: string;
  insuranceCompany: string;
  registrationBranchId: string;
  createdAt: string;
}

export type ServiceType = "ASSESSMENT" | "SINGLE_VISIT";

export interface Service {
  id: string;
  name: string;
  type: ServiceType;
  price: number;
  duration: number; // minutes
  status: "ACTIVE" | "INACTIVE";
}

export interface CourseTemplate {
  id: string;
  name: string;
  description: string;
  price: number;
  sessions: number;
  bonusSessions: number;
  expiryDays: number;
  status: "ACTIVE" | "INACTIVE";
}

export type PatientCourseStatus = "ACTIVE" | "EXPIRED" | "USED_UP";

export interface PatientCourse {
  id: string;
  patientId: string;
  courseId: string;
  purchaseDate: string;
  expiryDate: string;
  purchased: number;
  bonus: number;
  used: number;
  transferIn: number;
  transferOut: number;
  branchId: string;
  status: PatientCourseStatus;
}

export type LedgerEntryType =
  | "PURCHASE"
  | "BONUS"
  | "TREATMENT"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "VOID_REVERSAL";

export interface CourseLedgerEntry {
  id: string;
  patientCourseId: string;
  date: string;
  type: LedgerEntryType;
  quantity: number; // signed
  balanceAfter: number;
  branchId: string;
  relatedTransactionId?: string;
  transferGroupId?: string;
  transferCounterpartyPatientId?: string;
  performedBy: string; // staff name
}

export type AppointmentStatus =
  | "CONFIRMED"
  | "ARRIVED"
  | "IN_SERVICE"
  | "COMPLETED"
  | "CANCELLED"
  | "RESCHEDULED"
  | "NO_SHOW";

export interface Appointment {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  branchId: string;
  physiotherapistId: string;
  serviceId: string;
  resourceId: string;
  note?: string;
  status: AppointmentStatus;
  createdAt: string;
  checkedOut?: boolean;
}

export type TransactionType =
  | "ASSESSMENT"
  | "SINGLE_VISIT"
  | "COURSE_PURCHASE"
  | "COURSE_USAGE"
  | "MIXED";

export type TransactionStatus = "COMPLETED" | "VOID";

/**
 * BASE lines are the catalogue items being sold; SURCHARGE and DISCOUNT are
 * manual adjustments made at the counter. `amount` is signed — DISCOUNT lines
 * are negative — so the items always add up to the transaction total.
 * Undefined `kind` means BASE (seed data predates adjustments).
 */
export type LineItemKind = "BASE" | "SURCHARGE" | "DISCOUNT";

export interface TransactionLineItem {
  description: string;
  qty: number;
  amount: number;
  kind?: LineItemKind;
}

export interface CourseImpactEntry {
  label: string;
  quantity: number; // signed
}

export interface CommissionLine {
  ruleId: string;
  ruleName: string;
  staffId: string;
  type: "TREATMENT" | "SALES";
  amount: number;
}

export interface VoidInfo {
  voidBy: string;
  voidAt: string;
  reason: string;
}

export interface Transaction {
  id: string;
  transactionNo: string;
  date: string; // ISO
  patientId: string;
  branchId: string;
  appointmentId?: string;
  type: TransactionType;
  items: TransactionLineItem[];
  subtotal: number; // BASE lines only, before adjustments
  total: number; // what the patient actually paid

  paymentMethodId: string;
  treatingStaffId?: string;
  salespersonId?: string;
  status: TransactionStatus;
  courseImpact: CourseImpactEntry[];
  commission: CommissionLine[];
  patientCourseId?: string;
  voidInfo?: VoidInfo;
}

export type CommissionType = "PERCENTAGE" | "FIXED";
export type CommissionAppliesTo = "TREATMENT" | "SALES" | "BOTH";

export interface CommissionRule {
  id: string;
  name: string;
  appliesTo: CommissionAppliesTo;
  targetType: "SERVICE" | "COURSE" | "ALL";
  targetId?: string;
  commissionType: CommissionType;
  value: number;
  effectiveDate: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

export interface ResourceRoom {
  id: string;
  name: string;
  type: string;
  branchId: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface MasterDataItem {
  id: string;
  category: "CUSTOMER_GROUP" | "REFERRAL_CHANNEL" | "INSURANCE_COMPANY";
  value: string;
  status: "ACTIVE" | "INACTIVE";
}
