"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Ban,
  Bell,
  CalendarClock,
  CalendarOff,
  CalendarPlus,
  CalendarX2,
  ClipboardCheck,
  Clock,
  CloudOff,
  Hourglass,
  Lock,
  ShoppingCart,
  TriangleAlert,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import * as api from "@/lib/api/clinic-api";
import type { ClinicNotification } from "@/lib/api/clinic-api";
import { useLanguage } from "@/components/i18n/language-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** How often an open, visible tab asks the server for news. */
const POLL_MS = 30_000;

type Lang = "en" | "th";

function hm(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "14:00–15:00", with the day in front when it is not today. */
function slot(lang: Lang, start?: string, end?: string) {
  if (!start) return "";
  const date = new Date(start);
  const sameDay = date.toDateString() === new Date().toDateString();
  const day = sameDay
    ? ""
    : `${date.toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short" })} `;
  return `${day}${hm(start)}${end ? `–${hm(end)}` : ""}`;
}

function ago(lang: Lang, iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return lang === "th" ? "เมื่อสักครู่" : "just now";
  if (minutes < 60) return lang === "th" ? `${minutes} นาทีที่แล้ว` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === "th" ? `${hours} ชม.ที่แล้ว` : `${hours} h ago`;
  return new Date(iso).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short" });
}

/** "45 min", or "1 h 20 min" once it runs past an hour. */
function duration(lang: Lang, minutes: number) {
  const th = lang === "th";
  if (minutes < 60) return th ? `${minutes} นาที` : `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (th) return m ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function joined(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" · ");
}

interface Shown {
  icon: LucideIcon;
  tint: string;
  title: string;
  detail: string;
}

/**
 * The words for each kind of notification, in both languages. Written here
 * rather than through the page-wide translation catalogue because every one
 * carries names, times and counts.
 */
function describe(n: ClinicNotification, lang: Lang): Shown {
  const th = lang === "th";
  const who = n.actorName ?? (th ? "มีผู้ใช้" : "Someone");
  const patient = n.patientName;
  const when = slot(lang, n.startsAt, n.endsAt);
  const minutes = n.minutes ?? 0;
  switch (n.type) {
    case "MY_PATIENT_ARRIVED":
      return {
        icon: UserCheck, tint: "text-emerald-600 bg-emerald-500/10",
        title: th ? "คนไข้ของคุณมาถึงแล้ว" : "Your patient has arrived",
        detail: joined(patient, th ? `นัด ${hm(n.startsAt)}` : `booked ${hm(n.startsAt)}`),
      };
    case "STARTING_SOON":
      return {
        icon: Clock, tint: "text-sky-600 bg-sky-500/10",
        title: th ? `อีก ${minutes} นาทีถึงคิวคนไข้ถัดไป` : `Next patient in ${minutes} min`,
        detail: joined(patient, when),
      };
    case "BOOKING_HANDED_TO_YOU":
      return {
        icon: ArrowLeftRight, tint: "text-violet-600 bg-violet-500/10",
        title: th ? `${who} โอนนัดมาให้คุณ` : `${who} handed you a booking`,
        detail: joined(patient, when),
      };
    case "BOOKING_HANDED_AWAY":
      return {
        icon: ArrowLeftRight, tint: "text-violet-600 bg-violet-500/10",
        title: th ? `${who} ย้ายนัดของคุณไปให้นักกายภาพคนอื่น` : `${who} gave your booking to another therapist`,
        detail: joined(patient, when),
      };
    case "BOOKING_RETIMED":
      return {
        icon: CalendarClock, tint: "text-sky-600 bg-sky-500/10",
        title: th ? `${who} เปลี่ยนเวลานัดของคุณ` : `${who} changed your booking time`,
        detail: joined(patient, `${slot(lang, n.oldStartsAt, n.oldEndsAt)} → ${when}`),
      };
    case "BOOKING_RESCHEDULED":
      return {
        icon: CalendarClock, tint: "text-sky-600 bg-sky-500/10",
        title: th ? `${who} เลื่อนนัดของคุณ` : `${who} rescheduled your booking`,
        detail: joined(patient, th ? `เวลาใหม่ ${when}` : `now ${when}`),
      };
    case "BOOKING_NEW":
      return {
        icon: CalendarPlus, tint: "text-primary bg-primary/10",
        title: th ? `${who} ลงนัดใหม่ให้คุณ` : `${who} booked a patient for you`,
        detail: joined(patient, when),
      };
    case "BOOKING_CANCELLED":
      return {
        icon: CalendarX2, tint: "text-destructive bg-destructive/10",
        title: th ? `${who} ยกเลิกนัดของคุณ` : `${who} cancelled your booking`,
        detail: joined(patient, when),
      };
    case "BOOKING_NO_SHOW":
      return {
        icon: CalendarOff, tint: "text-amber-600 bg-amber-500/10",
        title: th ? "คนไข้ถูกบันทึกว่าไม่มาตามนัด" : "Marked as no-show",
        detail: joined(patient, when),
      };
    case "PATIENT_WAITING":
      return {
        icon: Hourglass, tint: "text-amber-600 bg-amber-500/10",
        title: th
          ? `รอมา ${duration(lang, minutes)} ยังไม่ได้รับบริการ`
          : `Waiting ${duration(lang, minutes)}, not yet seen`,
        detail: joined(patient, n.staffName),
      };
    case "PATIENT_LATE":
      return {
        icon: TriangleAlert, tint: "text-amber-600 bg-amber-500/10",
        title: th
          ? `เลยเวลานัด ${duration(lang, minutes)} คนไข้ยังไม่มา`
          : `Patient ${duration(lang, minutes)} late, not arrived yet`,
        detail: joined(patient, hm(n.startsAt), n.staffName),
      };
    case "BOOKINGS_LEFT_OPEN": {
      const count = n.count ?? 0;
      return {
        icon: ClipboardCheck, tint: "text-amber-600 bg-amber-500/10",
        title: th
          ? `วันนี้มี ${count} นัดที่ยังไม่ได้บันทึกว่ามาหรือไม่`
          : `${count} ${count === 1 ? "booking" : "bookings"} today not marked arrived or no-show`,
        detail: th ? "หมดเวลานัดแล้ว บันทึกผลได้ที่หน้า Calendar" : "Their time is over. Record them on the Calendar",
      };
    }
    case "AWAITING_CHECKOUT":
      return {
        icon: ShoppingCart, tint: "text-primary bg-primary/10",
        title: th ? "รักษาเสร็จแล้ว รอชำระเงิน" : "Visit waiting for checkout",
        detail: joined(patient, when),
      };
    case "TRANSACTION_VOIDED":
      return {
        icon: Ban, tint: "text-destructive bg-destructive/10",
        title: th ? `${who} ยกเลิกรายการ ${n.label ?? ""}` : `${who} voided ${n.label ?? "a transaction"}`,
        detail: joined(
          patient,
          n.amount != null ? `฿${Number(n.amount).toLocaleString(th ? "th-TH" : "en-GB")}` : undefined,
          n.reason
        ),
      };
    case "MONTH_TO_CLOSE": {
      const [year, month] = (n.label ?? "").split("-").map(Number);
      const name = year
        ? new Date(year, month - 1, 1).toLocaleDateString(th ? "th-TH" : "en-GB", { month: "long", year: "numeric" })
        : n.label;
      return {
        icon: Lock, tint: "text-violet-600 bg-violet-500/10",
        title: th ? `ยังไม่ได้ปิดยอดคอมมิชชันเดือน${name}` : `Commission for ${name} is not closed yet`,
        detail: th ? "ปิดยอดได้ที่หน้า Monthly Closing" : "Close it on the Monthly Closing page",
      };
    }
    case "CALENDAR_SYNC_FAILED":
      return {
        icon: CloudOff, tint: "text-destructive bg-destructive/10",
        title: th
          ? `${n.count ?? 0} นัดซิงก์ไป Google Calendar ไม่สำเร็จ`
          : `${n.count ?? 0} bookings didn't reach Google Calendar`,
        detail: th ? "ตรวจสอบการเชื่อมต่อของนักกายภาพ" : "Check the therapists' calendar connections",
      };
    default:
      return { icon: Bell, tint: "text-muted-foreground bg-muted", title: n.type, detail: patient ?? "" };
  }
}

/**
 * The header bell. The server decides what this person should hear about
 * and remembers what they have seen, so the count follows them between
 * devices; this asks again every half minute while the tab is in view.
 */
export function NotificationBell() {
  const router = useRouter();
  const { locale } = useLanguage();
  const lang: Lang = locale === "th" ? "th" : "en";
  const [items, setItems] = useState<ClinicNotification[]>([]);

  const refresh = useCallback(() => {
    api.listNotifications().then(
      (result) => setItems(result.items),
      // A missed poll is retried on the next one; the bell keeps what it had.
      () => undefined
    );
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      window.clearInterval(timer);
      if (document.visibilityState !== "visible") return;
      refresh();
      timer = window.setInterval(refresh, POLL_MS);
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [refresh]);

  const unread = items.filter((n) => !n.read).length;

  const markRead = (keys: string[]) => {
    if (keys.length === 0) return;
    setItems((current) => current.map((n) => (keys.includes(n.key) ? { ...n, read: true } : n)));
    api.markNotificationsRead(keys).catch(refresh);
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && refresh()}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className="h-4.5 w-4.5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none tabular-nums text-white ring-2 ring-card">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0" data-no-translate>
        <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5">
          <p className="text-sm font-semibold">
            {lang === "th" ? "การแจ้งเตือน" : "Notifications"}
            {unread > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive/10 px-1.5 py-px text-[11px] font-semibold text-destructive">
                {unread}
              </span>
            )}
          </p>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markRead(items.filter((n) => !n.read).map((n) => n.key))}
              className="cursor-pointer text-xs font-medium text-primary hover:underline"
            >
              {lang === "th" ? "อ่านทั้งหมดแล้ว" : "Mark all as read"}
            </button>
          )}
        </div>
        <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-1">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {lang === "th" ? "ไม่มีอะไรต้องจัดการตอนนี้" : "Nothing needs your attention right now."}
            </p>
          ) : (
            items.map((n) => {
              const shown = describe(n, lang);
              const Icon = shown.icon;
              return (
                <DropdownMenuItem
                  key={n.key}
                  onClick={() => {
                    markRead([n.key]);
                    router.push(n.href);
                  }}
                  className={cn("flex items-start gap-3 whitespace-normal rounded-md px-2.5 py-2.5", !n.read && "bg-primary/[0.04]")}
                >
                  <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", shown.tint)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm leading-snug", n.read ? "text-foreground/80" : "font-medium text-foreground")}>
                      {shown.title}
                    </span>
                    {shown.detail && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{shown.detail}</span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{ago(lang, n.occurredAt)}</span>
                  </span>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
