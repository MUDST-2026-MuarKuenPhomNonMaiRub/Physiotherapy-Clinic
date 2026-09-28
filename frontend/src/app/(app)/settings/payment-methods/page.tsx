"use client";

import { useState } from "react";
import { Banknote, CreditCard, Landmark, Pencil, Plus, QrCode, Smartphone, Trash2, Wallet } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PaymentMethod } from "@/types";
import { toast } from "sonner";

const icons = [
  { code: "Banknote", label: "เงินสด", icon: Banknote },
  { code: "Landmark", label: "ธนาคาร", icon: Landmark },
  { code: "CreditCard", label: "บัตร", icon: CreditCard },
  { code: "Wallet", label: "กระเป๋าเงิน", icon: Wallet },
  { code: "Smartphone", label: "แอปมือถือ", icon: Smartphone },
  { code: "QrCode", label: "QR Code", icon: QrCode },
];

export default function PaymentMethodsSettingsPage() {
  const paymentMethods = useClinicStore((s) => s.paymentMethods);
  const addPaymentMethod = useClinicStore((s) => s.addPaymentMethod);
  const updatePaymentMethod = useClinicStore((s) => s.updatePaymentMethod);
  const togglePaymentMethod = useClinicStore((s) => s.togglePaymentMethod);
  const deletePaymentMethod = useClinicStore((s) => s.deletePaymentMethod);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Wallet");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<PaymentMethod | null>(null);
  const duplicate = paymentMethods.some((pm) => !pm.deleted && pm.id !== editing?.id && pm.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());

  function openEditor(method?: PaymentMethod) {
    setEditing(method ?? null); setName(method?.name ?? "");
    setIcon(icons.some((i) => i.code === method?.icon) ? method!.icon : "Wallet");
    setEnabled(method?.enabled ?? true); setOpen(true);
  }

  async function save() {
    if (saving || !name.trim() || duplicate) return;
    setSaving(true);
    try {
      const data = { name: name.trim(), icon, enabled };
      if (editing) await updatePaymentMethod(editing.id, data);
      else await addPaymentMethod(data);
      toast.success(enabled ? "บันทึกแล้ว สามารถเลือกช่องทางนี้ตอนชำระเงินได้" : "บันทึกแล้ว ช่องทางนี้ยังปิดใช้งานอยู่");
      setOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <PageHeader title="Payment Methods" description="เพิ่มและจัดการช่องทางชำระเงิน ช่องทางที่เปิดใช้งานจะปรากฏตอนชำระเงินจริง"
        actions={<Button onClick={() => openEditor()}><Plus className="h-4 w-4" />เพิ่มช่องทางชำระเงิน</Button>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {paymentMethods.filter((pm) => !pm.deleted).map((pm) => {
          const Icon = icons.find((i) => i.code === pm.icon)?.icon ?? Wallet;
          return (
            <div key={pm.id} className={`flex flex-col gap-4 rounded-xl border p-5 shadow-xs ${pm.enabled ? "border-primary/20 bg-primary/[0.03]" : "border-border bg-card"}`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${pm.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><Icon className="h-6 w-6" /></div>
                <div className="min-w-0 flex-1"><h2 className="break-words text-sm font-semibold">{pm.name}</h2><p className="mt-1 text-xs text-muted-foreground">{pm.enabled ? "แสดงในหน้าชำระเงิน" : "ซ่อนจากหน้าชำระเงิน"}</p></div>
                <Button variant="ghost" size="icon" aria-label={`แก้ไข ${pm.name}`} disabled={toggling.includes(pm.id)} onClick={() => openEditor(pm)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="text-destructive" aria-label={`ลบ ${pm.name}`} disabled={toggling.includes(pm.id)} onClick={() => setDeleting(pm)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>{pm.code === "CASH" ? "รับเงินสดและคำนวณเงินทอน" : "บันทึกยอดชำระตามช่องทาง"}</span>
                <Switch aria-label={`เปิดใช้งาน ${pm.name}`} checked={pm.enabled} disabled={toggling.includes(pm.id)} onCheckedChange={async () => {
                  setToggling((ids) => [...ids, pm.id]);
                  try { await togglePaymentMethod(pm.id); toast.success(pm.enabled ? "ปิดช่องทางแล้ว" : "เปิดช่องทางแล้ว"); }
                  catch (error) { toast.error(error instanceof Error ? error.message : "เปลี่ยนสถานะไม่สำเร็จ"); }
                  finally { setToggling((ids) => ids.filter((id) => id !== pm.id)); }
                }} />
              </div>
            </div>
          );
        })}
        <button type="button" onClick={() => openEditor()} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"><Plus className="h-6 w-6" />เพิ่มช่องทางใหม่</button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">การเพิ่มช่องทางใช้สำหรับบันทึกการรับชำระ ยังไม่เชื่อมรับเงินอัตโนมัติจากธนาคารหรือสร้าง QR สำหรับโอนเงิน</p>
      <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "แก้ไขช่องทางชำระเงิน" : "เพิ่มช่องทางชำระเงิน"}</DialogTitle><DialogDescription>ตั้งชื่อและเลือกสัญลักษณ์ จากนั้นเปิดใช้งานเพื่อให้เลือกได้ในหน้าชำระเงิน</DialogDescription></DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="payment-name">ชื่อช่องทาง</Label><Input id="payment-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required placeholder="เช่น โอนธนาคารกสิกร, บัตรเครดิต, Wallet" disabled={saving} />{duplicate && <p role="alert" className="text-xs text-destructive">มีชื่อช่องทางนี้อยู่แล้ว กรุณาใช้ชื่ออื่น</p>}</div>
            <fieldset disabled={saving}><legend className="mb-2 text-sm font-medium">สัญลักษณ์</legend><div className="grid grid-cols-3 gap-2">{icons.map((item) => <button key={item.code} type="button" aria-pressed={icon === item.code} onClick={() => setIcon(item.code)} className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs ${icon === item.code ? "border-primary bg-primary/10 text-primary" : "border-border"}`}><item.icon className="h-5 w-5" />{item.label}</button>)}</div></fieldset>
            <div className="flex items-center justify-between"><Label htmlFor="payment-enabled">เปิดให้เลือกตอนชำระเงิน</Label><Switch id="payment-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={saving} /></div>
            <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>ยกเลิก</Button><Button type="submit" disabled={saving || !name.trim() || duplicate}>{saving ? "กำลังบันทึก…" : "บันทึก"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(next) => { if (!next && !saving) setDeleting(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>ลบช่องทางชำระเงิน?</DialogTitle><DialogDescription>ลบ “{deleting?.name}” ออกจากตัวเลือกชำระเงินใหม่ รายการชำระเงินเก่ายังคงแสดงช่องทางนี้ได้</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDeleting(null)}>ยกเลิก</Button><Button variant="destructive" disabled={saving} onClick={async () => {
            if (!deleting || saving) return;
            setSaving(true);
            try { await deletePaymentMethod(deleting.id); setDeleting(null); toast.success("ลบช่องทางแล้ว"); }
            catch (error) { toast.error(error instanceof Error ? error.message : "ลบไม่สำเร็จ"); }
            finally { setSaving(false); }
          }}>{saving ? "กำลังลบ…" : "ยืนยันลบ"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
