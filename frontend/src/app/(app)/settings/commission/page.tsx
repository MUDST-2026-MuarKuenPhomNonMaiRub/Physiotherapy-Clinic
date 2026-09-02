"use client";

import { useState } from "react";
import { Pencil, Percent, Plus } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CommissionAppliesTo, CommissionRule, CommissionType } from "@/types";
import { toast } from "sonner";

const appliesToStyle: Record<CommissionAppliesTo, { label: string; className: string }> = {
  TREATMENT: { label: "Treatment", className: "bg-success/10 text-success border-success/20" },
  SALES: { label: "Sales", className: "bg-info/10 text-info border-info/20" },
  BOTH: { label: "Treatment + Sales", className: "bg-primary/10 text-primary border-primary/20" },
};

const emptyForm = {
  name: "", appliesTo: "TREATMENT" as CommissionAppliesTo, targetType: "ALL" as "ALL" | "SERVICE" | "COURSE",
  targetId: "", commissionType: "PERCENTAGE" as CommissionType, value: 5, effectiveDate: "2026-08-12",
};

export default function CommissionSettingsPage() {
  const commissionRules = useClinicStore((s) => s.commissionRules);
  const services = useClinicStore((s) => s.services);
  const courseTemplates = useClinicStore((s) => s.courseTemplates);
  const addCommissionRule = useClinicStore((s) => s.addCommissionRule);
  const updateCommissionRule = useClinicStore((s) => s.updateCommissionRule);
  const toggleCommissionRuleStatus = useClinicStore((s) => s.toggleCommissionRuleStatus);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CommissionRule | null>(null);
  const [form, setForm] = useState(emptyForm);

  function openCreate() { setEditing(null); setForm(emptyForm); setOpen(true); }
  function openEdit(r: CommissionRule) {
    setEditing(r);
    setForm({ name: r.name, appliesTo: r.appliesTo, targetType: r.targetType, targetId: r.targetId ?? "", commissionType: r.commissionType, value: r.value, effectiveDate: r.effectiveDate });
    setOpen(true);
  }
  async function save() {
    if (!form.name) return;
    const payload = { ...form, targetId: form.targetType === "ALL" || !form.targetId ? undefined : form.targetId };
    try {
      if (editing) { await updateCommissionRule(editing.id, payload); toast.success("Commission rule updated"); }
      else { await addCommissionRule({ ...payload, status: "ACTIVE" }); toast.success("Commission rule created"); }
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the change");
    }
  }

  async function toggleStatus(id: string) {
    try {
      await toggleCommissionRuleStatus(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the status");
    }
  }

  function targetLabel(r: CommissionRule) {
    if (r.targetType === "ALL") return "All Services / Courses";
    if (r.targetType === "SERVICE") return r.targetId ? (services.find((s) => s.id === r.targetId)?.name ?? "—") : "All Services";
    return r.targetId ? (courseTemplates.find((c) => c.id === r.targetId)?.name ?? "—") : "All Courses";
  }

  return (
    <>
      <PageHeader
        title="Commission Rules"
        description="Define how treating staff and salespeople earn commission on services and courses"
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Rule</Button>}
      />

      {commissionRules.length === 0 ? (
        <EmptyState icon={Percent} title="No commission rules yet" action={<Button onClick={openCreate}>Add Rule</Button>} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Applies To</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionRules.map((r) => (
                  <TableRow key={r.id} className="[&>td]:py-3.5">
                    <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${appliesToStyle[r.appliesTo].className}`}>
                        {appliesToStyle[r.appliesTo].label}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{targetLabel(r)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-mono text-sm font-semibold text-foreground">
                        {r.commissionType === "PERCENTAGE" ? `${r.value}%` : formatCurrency(r.value)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(r.effectiveDate)}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Switch checked={r.status === "ACTIVE"} onCheckedChange={() => void toggleStatus(r.id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Commission Rule" : "Add Commission Rule"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Rule Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Applies To</Label>
                <Select value={form.appliesTo} onValueChange={(v) => setForm((f) => ({ ...f, appliesTo: v as CommissionAppliesTo }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TREATMENT">Treatment</SelectItem>
                    <SelectItem value="SALES">Sales</SelectItem>
                    <SelectItem value="BOTH">Treatment + Sales</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Target Type</Label>
                <Select value={form.targetType} onValueChange={(v) => setForm((f) => ({ ...f, targetType: v as "ALL" | "SERVICE" | "COURSE" }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="SERVICE">Specific Service</SelectItem>
                    <SelectItem value="COURSE">Specific Course</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.targetType !== "ALL" && (
              <div className="space-y-1.5">
                <Label>{form.targetType === "SERVICE" ? "Service" : "Course"}</Label>
                <Select value={form.targetId} onValueChange={(v) => setForm((f) => ({ ...f, targetId: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {(form.targetType === "SERVICE" ? services : courseTemplates).map((x) => (
                      <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.commissionType} onValueChange={(v) => setForm((f) => ({ ...f, commissionType: v as CommissionType }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    <SelectItem value="FIXED">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{form.commissionType === "PERCENTAGE" ? "Percentage" : "Amount (THB)"}</Label>
                <Input type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Effective Date</Label>
                <Input type="date" value={form.effectiveDate} onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.name} onClick={save}>{editing ? "Save Changes" : "Add Rule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
