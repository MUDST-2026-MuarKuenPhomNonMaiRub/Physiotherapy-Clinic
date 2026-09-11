import { today } from "@/lib/domain";

export function formatCurrency(amount: number): string {
  return `฿${amount.toLocaleString("en-US")}`;
}

/** "-฿250" / "+฿150" — keeps the sign in front of the symbol, not after it. */
export function formatCurrencySigned(amount: number): string {
  const sign = amount < 0 ? "-" : "+";
  return `${sign}${formatCurrency(Math.abs(amount))}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatThaiNationalId(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 13
    ? `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`
    : value || "-";
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 9 && digits.startsWith("0")) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  return value || "-";
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${d.toLocaleTimeString(
    "en-GB",
    { hour: "2-digit", minute: "2-digit" }
  )}`;
}

export function formatTime(timeStr: string): string {
  return timeStr;
}

export function calcAge(dob: string): number {
  const birth = new Date(dob + "T00:00:00");
  const now = new Date(today() + "T00:00:00");
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date(today() + "T00:00:00");
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
