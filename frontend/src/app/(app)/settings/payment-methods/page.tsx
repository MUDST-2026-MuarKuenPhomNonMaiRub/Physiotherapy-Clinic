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
import { useLanguage } from "@/components/i18n/language-provider";

const icons = [
  { code: "Banknote", label: "Cash", icon: Banknote },
  { code: "Landmark", label: "Bank", icon: Landmark },
  { code: "CreditCard", label: "Card", icon: CreditCard },
  { code: "Wallet", label: "Wallet", icon: Wallet },
  { code: "Smartphone", label: "Mobile app", icon: Smartphone },
  { code: "QrCode", label: "QR Code", icon: QrCode },
];

export default function PaymentMethodsSettingsPage() {
  const { t } = useLanguage();
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
      toast.success(enabled ? "Saved. This method is available at checkout." : "Saved. This method is still disabled.");
      setOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save the payment method"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <PageHeader title="Payment Methods" description="Add and manage payment methods. Enabled methods appear at checkout."
        actions={<Button onClick={() => openEditor()}><Plus className="h-4 w-4" />Add Payment Method</Button>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {paymentMethods.filter((pm) => !pm.deleted).map((pm) => {
          const Icon = icons.find((i) => i.code === pm.icon)?.icon ?? Wallet;
          return (
            <div key={pm.id} className={`flex flex-col gap-4 rounded-xl border p-5 shadow-xs ${pm.enabled ? "border-primary/20 bg-primary/[0.03]" : "border-border bg-card"}`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${pm.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><Icon className="h-6 w-6" /></div>
                <div className="min-w-0 flex-1"><h2 className="break-words text-sm font-semibold">{t(pm.name)}</h2><p className="mt-1 text-xs text-muted-foreground">{pm.enabled ? "Shown at checkout" : "Hidden from checkout"}</p></div>
                <Button variant="ghost" size="icon" aria-label={t(`Edit ${pm.name}`)} disabled={toggling.includes(pm.id)} onClick={() => openEditor(pm)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="text-destructive" aria-label={t(`Delete ${pm.name}`)} disabled={toggling.includes(pm.id)} onClick={() => setDeleting(pm)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>{pm.code === "CASH" ? "Accept cash and calculate change" : "Record payment through this method"}</span>
                <Switch aria-label={t(`Enable ${pm.name}`)} checked={pm.enabled} disabled={toggling.includes(pm.id)} onCheckedChange={async () => {
                  setToggling((ids) => [...ids, pm.id]);
                  try { await togglePaymentMethod(pm.id); toast.success(pm.enabled ? "Payment method disabled" : "Payment method enabled"); }
                  catch (error) { toast.error(error instanceof Error ? error.message : "Could not change the status"); }
                  finally { setToggling((ids) => ids.filter((id) => id !== pm.id)); }
                }} />
              </div>
            </div>
          );
        })}
        <button type="button" onClick={() => openEditor()} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"><Plus className="h-6 w-6" />Add New Method</button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Payment methods record how a payment was received. They do not collect money from a bank or generate transfer QR codes.</p>
      <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Payment Method" : "Add Payment Method"}</DialogTitle><DialogDescription>Name the method and choose an icon. Enable it to make it available at checkout.</DialogDescription></DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="payment-name">Method Name</Label><Input id="payment-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required placeholder="For example: KBank transfer, credit card, wallet" disabled={saving} />{duplicate && <p role="alert" className="text-xs text-destructive">This payment method name already exists. Use another name.</p>}</div>
            <fieldset disabled={saving}><legend className="mb-2 text-sm font-medium">Icon</legend><div className="grid grid-cols-3 gap-2">{icons.map((item) => <button key={item.code} type="button" aria-pressed={icon === item.code} onClick={() => setIcon(item.code)} className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs ${icon === item.code ? "border-primary bg-primary/10 text-primary" : "border-border"}`}><item.icon className="h-5 w-5" />{item.label}</button>)}</div></fieldset>
            <div className="flex items-center justify-between"><Label htmlFor="payment-enabled">Available at checkout</Label><Switch id="payment-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={saving} /></div>
            <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving || !name.trim() || duplicate}>{saving ? "Saving…" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(next) => { if (!next && !saving) setDeleting(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Payment Method?</DialogTitle><DialogDescription>{t(`Remove “${deleting?.name ?? ""}” from new payments. Existing payment records will still show this method.`)}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={async () => {
            if (!deleting || saving) return;
            setSaving(true);
            try { await deletePaymentMethod(deleting.id); setDeleting(null); toast.success("Payment method deleted"); }
            catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete the payment method"); }
            finally { setSaving(false); }
          }}>{saving ? "Deleting…" : "Confirm Delete"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
