"use client";

import { useEffect, useState } from "react";
import { HandCoins, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { createTreatmentFeeRule, listTreatmentFeeRules, setTreatmentFeeRuleActive, updateTreatmentFeeRule } from "@/lib/api/clinic-api";
import { useClinicStore } from "@/lib/store/clinic-store";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TreatmentFeeRule } from "@/types";

const emptyForm = {
  employeeId: "",
  feeType: "FIXED" as TreatmentFeeRule["feeType"],
  feeValue: 0,
  percentageBase: "COURSE_VALUE_PER_VISIT",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: "",
  employeeGroup: "",
  serviceId: "",
};

/**
 * What a substitute physiotherapist earns from a case owner's commission
 * allocation when they, not the owner, actually treat the visit. Most
 * specific rule wins — an employee-specific rule beats a global default; see
 * TreatmentFeeResolver on the backend for the exact ordering.
 */
export default function TreatmentFeeRulesPage() {
  const staff = useClinicStore((s) => s.staff);
  const services = useClinicStore((s) => s.services);
  const [rules, setRules] = useState<TreatmentFeeRule[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TreatmentFeeRule | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    try {
      setRules(await listTreatmentFeeRules());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load treatment fee rules");
    }
  }

  useEffect(() => {
    // load() only sets state after its own await, inside the fetch's
    // resolution — not synchronously on this render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  async function save() {
    try {
      const payload = {
        employeeId: form.employeeId || undefined,
        employeeGroup: form.employeeGroup || undefined,
        serviceId: form.serviceId || undefined,
        feeType: form.feeType,
        feeValue: form.feeValue,
        percentageBase: form.feeType === "PERCENTAGE" ? form.percentageBase : undefined,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || undefined,
      };
      if (editing) {
        await updateTreatmentFeeRule(editing.id, payload);
        toast.success("Treatment fee rule updated");
      } else {
        await createTreatmentFeeRule(payload);
        toast.success("Treatment fee rule created");
      }
      setOpen(false);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the rule");
    }
  }

  function openEdit(rule: TreatmentFeeRule) {
    setEditing(rule);
    setForm({
      employeeId: rule.employeeId ?? "",
      employeeGroup: rule.employeeGroup ?? "",
      serviceId: rule.serviceId ?? "",
      feeType: rule.feeType,
      feeValue: rule.feeValue,
      percentageBase: rule.percentageBase ?? "COURSE_VALUE_PER_VISIT",
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo ?? "",
    });
    setOpen(true);
  }

  async function toggle(id: string, active: boolean) {
    try {
      await setTreatmentFeeRuleActive(id, active);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the rule");
    }
  }

  return (
    <>
      <PageHeader
        title="Treatment Fee Rules"
        description="What a substitute physiotherapist is paid from the visit's commission allocation when they treat a patient who is not their own case. No rule at all here means no fee — the owner keeps the full allocation."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Rule</Button>}
      />

      {rules.length === 0 ? (
        <EmptyState icon={HandCoins} title="No treatment fee rules yet" action={<Button onClick={openCreate}>Add Rule</Button>} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Effective From</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium text-foreground">
                    {rule.employeeId
                      ? staff.find((s) => s.id === rule.employeeId)?.name ?? `#${rule.employeeId}`
                      : rule.employeeGroup ?? "All employees (default)"}
                  </TableCell>
                  <TableCell className="font-mono">
                    {rule.feeType === "FIXED" ? `฿${rule.feeValue} / visit` : `${rule.feeValue}% of course value/visit`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(rule.effectiveFrom)}</TableCell>
                  <TableCell>
                    <Switch checked={rule.active} onCheckedChange={(v) => void toggle(rule.id, v)} />
                  </TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(rule)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Treatment Fee Rule" : "Add Treatment Fee Rule"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee (blank = applies to everyone)</Label>
              <Select value={form.employeeId} onValueChange={(v) => setForm((f) => ({ ...f, employeeId: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All employees" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Employee Group (optional)</Label><Input value={form.employeeGroup} onChange={(e) => setForm((f) => ({ ...f, employeeGroup: e.target.value, employeeId: "" }))} placeholder="e.g. PHYSIO" /></div>
              <div className="space-y-1.5"><Label>Service (optional)</Label><Select value={form.serviceId} onValueChange={(v) => setForm((f) => ({ ...f, serviceId: v }))}><SelectTrigger className="w-full"><SelectValue placeholder="All services" /></SelectTrigger><SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fee Type</Label>
                <Select value={form.feeType} onValueChange={(v) => setForm((f) => ({ ...f, feeType: v as TreatmentFeeRule["feeType"] }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixed / visit</SelectItem>
                    <SelectItem value="PERCENTAGE">% of course value / visit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{form.feeType === "FIXED" ? "Amount (THB)" : "Percentage"}</Label>
                <Input type="number" value={form.feeValue} onChange={(e) => setForm((f) => ({ ...f, feeValue: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Effective From</Label>
              <Input type="date" value={form.effectiveFrom} onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))} />
            </div>
            <div className="space-y-1.5"><Label>Effective To (optional)</Label><Input type="date" value={form.effectiveTo} onChange={(e) => setForm((f) => ({ ...f, effectiveTo: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save Changes" : "Add Rule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
