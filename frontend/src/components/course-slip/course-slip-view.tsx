"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import styles from "./course-slip.module.css";

export interface CourseSlipRow {
  id: string;
  date: string;
  therapistName: string;
  patientName: string;
  quantity: number;
}

export interface CourseSlipData {
  purchaseDate: string;
  expiryDate: string;
  courseName: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  branch?: { name: string; address: string; phone: string };
  rows: CourseSlipRow[];
}

const subscribe = () => () => {};

function formatThaiDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist-nu-latn", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function createPrintStamp() {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist-nu-latn", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

export function CourseSlipView({ data, backHref }: { data: CourseSlipData; backHref: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [printedAt, setPrintedAt] = useState("");
  const printedAtRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const updatePrintStamp = () => {
      const stamp = createPrintStamp();
      if (printedAtRef.current) printedAtRef.current.textContent = stamp;
      setPrintedAt(stamp);
    };

    updatePrintStamp();
    window.addEventListener("beforeprint", updatePrintStamp);
    return () => window.removeEventListener("beforeprint", updatePrintStamp);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className={styles.viewer} lang="th" data-no-translate>
      <div className={styles.toolbar}>
        <Link href={backHref}>
          <ArrowLeft size={17} /> กลับหน้ารายละเอียดคอร์ส
        </Link>
        <button
          type="button"
          onClick={async () => {
            await document.fonts.ready;
            window.print();
          }}
        >
          <Printer size={17} /> พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className={styles.notice}>
        <strong>ตัวอย่างใบตัดคอร์สจากข้อมูลปัจจุบัน</strong>
        <p>ตรวจสอบข้อมูลก่อนพิมพ์ • ใช้กระดาษ A4 แนวตั้ง • ขนาด 100%</p>
      </div>

      <div className={styles.paperScroll}>
        <article className={styles.paper} aria-label="ใบตัดคอร์สการรักษา">
          <header className={styles.header}>
            <h1>ใบตัดคอร์สการรักษา</h1>
            <p className={styles.clinicName}>{data.branch?.name ?? "—"}</p>
            <p className={styles.clinicContact}>
              {data.branch?.address || "—"}
              {data.branch?.phone ? ` โทรศัพท์: ${data.branch.phone}` : ""}
            </p>
          </header>

          <div className={styles.rule} />

          <p className={styles.printedAt}>
            วันที่พิมพ์: <span ref={printedAtRef}>{printedAt || "—"}</span>
          </p>

          <section className={styles.courseSummary} aria-label="สรุปคอร์ส">
            <p>วันที่ซื้อคอร์ส: <strong>{formatThaiDate(data.purchaseDate)}</strong></p>
            <p>จำนวน: <strong>{data.totalSessions}</strong> ครั้ง</p>
            <p>ใช้ไปแล้ว: <strong>{data.usedSessions}</strong> ครั้ง</p>
            <p>คงเหลือ: <strong>{data.remainingSessions}</strong> ครั้ง</p>
          </section>

          <section className={styles.courseDetails} aria-label="รายละเอียดคอร์ส">
            <p>คอร์ส: <strong>{data.courseName}</strong></p>
            <p>หมดอายุ: <strong>{formatThaiDate(data.expiryDate)}</strong></p>
          </section>

          <table className={styles.usageTable}>
            <colgroup>
              <col className={styles.dateColumn} />
              <col className={styles.therapistColumn} />
              <col className={styles.patientColumn} />
              <col className={styles.quantityColumn} />
            </colgroup>
            <thead>
              <tr>
                <th>วันที่เข้ารักษา</th>
                <th>นักกายภาพที่ทำการรักษา</th>
                <th>ผู้ใช้งานแพ็คเกจ</th>
                <th>จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className={styles.dataRow}>
                  <td>{formatThaiDate(row.date)}</td>
                  <td>{row.therapistName}</td>
                  <td>{row.patientName}</td>
                  <td>{row.quantity}</td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr className={styles.emptyRow}>
                  <td colSpan={4}>ยังไม่มีประวัติการใช้คอร์ส</td>
                </tr>
              )}
              <tr className={styles.fillerRow} aria-hidden="true">
                <td />
                <td />
                <td />
                <td />
              </tr>
              <tr className={styles.totalRow}>
                <td colSpan={3}>รวมจำนวนครั้งที่ใช้</td>
                <td>{data.usedSessions}</td>
              </tr>
            </tbody>
          </table>

        </article>
      </div>
    </div>,
    document.body,
  );
}
