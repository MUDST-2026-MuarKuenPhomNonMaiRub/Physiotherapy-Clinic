import { ReceiptView, type ReceiptData } from "@/components/receipts/receipt-view";

// This public preview contains only fictional data and never reads the clinic store.
const demo: ReceiptData = {
  demo: true,
  branch: { name: "ลาบาลองซ์ สหคลินิก สาขาตัวอย่าง", address: "123 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพมหานคร 10250", phone: "02-000-0000" },
  patient: { name: "คุณตัวอย่าง ทดสอบระบบ", hn: "DEMO-001", identity: "—", phone: "080-000-0000", address: "99 ถนนตัวอย่าง กรุงเทพมหานคร 10310" },
  paymentMethod: "เงินสด",
  transaction: {
    id: "demo", transactionNo: "DEMO-20260922-001", date: "2026-09-22T07:30:00+07:00",
    patientId: "demo", branchId: "demo", type: "SINGLE_VISIT", status: "COMPLETED", paymentMethodId: "demo",
    items: [
      { description: "Full Recovery — ฟื้นฟูสมรรถภาพร่างกาย", qty: 1, amount: 2500 },
      { description: "Physical Examination — ตรวจประเมินร่างกาย", qty: 1, amount: 500 },
      { description: "ส่วนลดท้ายบิล", qty: 1, amount: -500, kind: "DISCOUNT" },
    ],
    subtotal: 3000, total: 2500, cashReceived: 2500, changeGiven: 0, commission: [], courseImpact: [],
  },
};

export default function ReceiptPreviewPage() {
  return <ReceiptView data={demo} backHref="/login" />;
}
