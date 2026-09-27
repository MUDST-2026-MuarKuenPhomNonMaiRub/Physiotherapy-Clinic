"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { ClinicLogo } from "@/components/layout/clinic-logo";
import type { Transaction } from "@/types";
import styles from "./receipt.module.css";

export interface ReceiptData {
  transaction: Transaction;
  branch?: { name: string; address: string; phone: string };
  patient?: { name: string; hn: string; identity?: string; phone: string; address: string };
  paymentMethod?: string;
  demo?: boolean;
}

const money = (value: number) => `฿${value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value: string) => new Date(value).toLocaleDateString("th-TH-u-ca-gregory", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric" });
const subscribe = () => () => {};

function readInteger(value: number): string {
  if (value === 0) return "";
  if (value >= 1000000) return `${readInteger(Math.floor(value / 1000000))}ล้าน${value % 1000000 === 1 ? "เอ็ด" : readInteger(value % 1000000)}`;
  const digits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
  return String(value).split("").map((digit, index, all) => {
    const n = Number(digit);
    const place = all.length - index - 1;
    if (!n) return "";
    if (place === 1) return n === 1 ? "สิบ" : n === 2 ? "ยี่สิบ" : `${digits[n]}สิบ`;
    if (place === 0 && n === 1 && value > 10) return "เอ็ด";
    return `${digits[n]}${units[place]}`;
  }).join("");
}

export function thaiBahtText(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const satang = Math.round(Math.abs(amount) * 100);
  return `${amount < 0 ? "ลบ" : ""}${readInteger(Math.floor(satang / 100)) || "ศูนย์"}บาท${satang % 100 ? `${readInteger(satang % 100)}สตางค์` : "ถ้วน"}`;
}

export function ReceiptView({ data, backHref }: { data: ReceiptData; backHref: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [printedAt, setPrintedAt] = useState("");
  const timeRef = useRef<HTMLSpanElement>(null);
  const { transaction: txn, branch, patient } = data;

  useEffect(() => {
    const stamp = () => {
      const now = new Date().toLocaleString("th-TH-u-ca-gregory", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
      // beforeprint also covers Ctrl+P. Update the DOM synchronously for the print snapshot.
      if (timeRef.current) timeRef.current.textContent = now;
      setPrintedAt(now);
    };
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);

  if (!mounted) return null;
  const discount = -txn.items.filter((item) => item.kind === "DISCOUNT").reduce((sum, item) => sum + item.amount, 0);
  const surcharge = txn.items.filter((item) => item.kind === "SURCHARGE").reduce((sum, item) => sum + item.amount, 0);

  return createPortal(
    <div className={styles.viewer} lang="th" data-no-translate>
      <div className={styles.toolbar}>
        <Link href={backHref}><ArrowLeft size={17} />{data.demo ? "กลับหน้าเข้าสู่ระบบ" : "กลับรายการชำระเงิน"}</Link>
        <button onClick={async () => { await document.fonts.ready; window.print(); }}><Printer size={17} />พิมพ์ / บันทึก PDF</button>
      </div>
      <div className={styles.notice}>
        <strong>{data.demo ? "ตัวอย่างหน้าตา • ข้อมูลสมมติทั้งหมด" : "ตัวอย่างใบเสร็จจากข้อมูลปัจจุบัน"}</strong>
        <p>ใช้เลขธุรกรรมเป็นเลขอ้างอิง ยังไม่ได้ออกเลขใบเสร็จใหม่ ช่องที่ไม่มีข้อมูลแสดง — และยังไม่คำนวณภาษี</p>
        <p>พิมพ์: A4 แนวตั้ง • ขนาด 100% • ปิดหัวกระดาษและท้ายกระดาษของเบราว์เซอร์ • เปิดกราฟิกพื้นหลัง</p>
      </div>
      <div className={styles.paperScroll}>
        <article className={styles.paper} aria-label="ใบเสร็จรับเงิน">
          <header className={styles.header}>
            <ClinicLogo className={styles.logo} />
            <div className={styles.clinic}>
              <h2>{branch?.name || "คลินิกกายภาพบำบัด"}</h2>
              <p>ที่อยู่: {branch?.address || "—"}</p>
              <p>โทร: {branch?.phone || "—"} อีเมล: —</p>
              <p>เลขที่ใบอนุญาต: —</p>
              <p>เลขประจำตัวผู้เสียภาษี: —</p>
            </div>
            <div className={styles.documentInfo}>
              <h1>ใบเสร็จรับเงิน</h1>
              <div><p>เลขที่เอกสาร: —</p><p>เลขอ้างอิง: {txn.transactionNo}</p><p>วันที่รายการ: {date(txn.date)}</p></div>
            </div>
          </header>
          <div className={styles.draft}>{data.demo ? "ตัวอย่าง • ข้อมูลสมมติ • ไม่ใช่หลักฐานการรับเงิน" : "ฉบับร่าง • ยังไม่ได้ออกเลขใบเสร็จ"}</div>
          {txn.status === "VOID" && <div className={styles.void}>ยกเลิกรายการ — ใช้เป็นหลักฐานการชำระเงินไม่ได้</div>}
          <section className={styles.patient} aria-label="ข้อมูลผู้รับบริการ">
            <p><b>ผู้รับบริการ/ผู้บริโภค:</b> {patient?.name || "—"}</p><p><b>รหัสลูกค้า:</b> {patient?.hn || "—"}</p>
            <p><b>เลขบัตรประชาชน/พาสปอร์ต:</b> {patient?.identity || "—"}</p><p><b>โทร:</b> {patient?.phone || "—"}</p>
            <p className={styles.full}><b>ที่อยู่:</b> {patient?.address || "—"}</p>
            <p><b>อีเมล:</b> —</p>
          </section>
          <div className={styles.items}>
            <table>
              <thead><tr><th>รายการ</th><th>จำนวน</th><th>ราคา/หน่วย*</th><th>หน่วย</th><th>ส่วนลด/หน่วย</th><th>ยอดรวม</th></tr></thead>
              <tbody>{txn.items.map((item, i) => {
                const adjustment = item.kind === "DISCOUNT" || item.kind === "SURCHARGE";
                return <tr key={i}><td>{i + 1}. {item.description}</td><td>{item.qty}</td><td>{!adjustment && item.qty > 0 ? money(item.amount / item.qty) : "—"}</td><td>—</td><td>—</td><td>{money(item.amount)}</td></tr>;
              })}</tbody>
            </table>
          </div>
          <section className={styles.summary} aria-label="สรุปยอดชำระ">
            <div className={styles.box}>
              <p><span>ยอดทั้งหมด</span><span>{money(txn.subtotal)}</span></p>
              <p><span>ส่วนลดท้ายบิล</span><span>{money(discount)}</span></p>
              {surcharge !== 0 && <p><span>ค่าใช้จ่ายเพิ่มเติม</span><span>{money(surcharge)}</span></p>}
              <p><span>มูลค่าก่อนภาษี</span><span>—</span></p>
              <p><span>ภาษีมูลค่าเพิ่ม</span><span>—</span></p>
              <p><b>ยอดชำระตามรายการ</b><b>{money(txn.total)}</b></p>
            </div>
            <div className={styles.box}>
              <p><span>สถานะการชำระ</span><b>{txn.status === "VOID" ? "ยกเลิกรายการ" : "ชำระเต็มจำนวน"}</b></p>
              <p><span>ช่องทางการชำระ</span><span>{data.paymentMethod || "—"}</span></p>
              <p className={styles.total}><b>ยอดสุทธิ</b><b>{money(txn.total)}</b></p>
              <div className={styles.words}>({thaiBahtText(txn.total)})</div>
            </div>
          </section>
          <section className={styles.notes}>
            <p>แต้มคงเหลือ: — <span>วงเงินคงเหลือ: —</span></p>
            <p>หมายเหตุ: {txn.status === "VOID" ? txn.voidInfo?.reason || "ยกเลิกรายการ" : "—"}</p>
            <p className={styles.footnote}>* ราคา/หน่วยคำนวณจากยอดรายการ ÷ จำนวน ส่วนลด/ค่าบริการเพิ่มเติมแสดงเป็นรายการแยก</p>
          </section>
          <section className={styles.signatures} aria-label="ช่องลงลายมือชื่อ">
            {["ผู้รับบริการ", "ผู้ทำรายการ", "ผู้มีอำนาจออกหลักฐานการรับเงิน"].map((label) => <div key={label}><div className={styles.signatureLine} /><p>(............................................................)</p><p>{label}</p></div>)}
          </section>
          <footer className={styles.footer}><span>{data.demo ? "ข้อมูลสมมติสำหรับตรวจรูปแบบ" : "ฉบับร่างจากข้อมูลปัจจุบัน"}</span><span>พิมพ์เมื่อ: <span ref={timeRef}>{printedAt || "—"}</span></span></footer>
        </article>
      </div>
    </div>, document.body,
  );
}
