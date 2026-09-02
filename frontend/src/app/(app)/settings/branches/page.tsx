"use client";

import { useState } from "react";
import { Building2, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Branch } from "@/types";
import { toast } from "sonner";

const emptyForm = { name: "", code: "", phone: "", address: "" };

export default function BranchesSettingsPage() {
  const branches = useClinicStore((s) => s.branches);
  const addBranch = useClinicStore((s) => s.addBranch);
  const updateBranch = useClinicStore((s) => s.updateBranch);
  const toggleBranchStatus = useClinicStore((s) => s.toggleBranchStatus);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyForm);

  function openCreate() {
    setEditing(null); setForm(emptyForm); setOpen(true);
  }
  function openEdit(b: Branch) {
    setEditing(b); setForm({ name: b.name, code: b.code, phone: b.phone, address: b.address }); setOpen(true);
  }
  async function save() {
    if (!form.name || !form.code) return;
    try {
      if (editing) {
        await updateBranch(editing.id, form);
        toast.success("Branch updated");
      } else {
        await addBranch({ ...form, status: "ACTIVE" });
        toast.success("Branch created");
      }
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the change");
    }
  }

  async function toggleStatus(id: string) {
    try {
      await toggleBranchStatus(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the status");
    }
  }

  return (
    <>
      <PageHeader
        title="Branches"
        description="Manage clinic branch locations used across HN generation, scheduling and reporting"
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Create Branch</Button>}
      />

      {branches.length === 0 ? (
        <EmptyState icon={Building2} title="No branches yet" action={<Button onClick={openCreate}>Create Branch</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <div
              key={b.id}
              className="group rounded-xl border border-border bg-card p-5 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <Switch checked={b.status === "ACTIVE"} onCheckedChange={() => void toggleStatus(b.id)} />
              </div>

              <p className="mt-3 text-base font-semibold text-foreground">{b.name}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                  {b.code}
                </span>
                <StatusBadge status={b.status} />
              </div>

              <div className="mt-4 space-y-2 border-t border-border pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{b.phone}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="line-clamp-2">{b.address}</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => openEdit(b)}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Branch
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Branch" : "Create Branch"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Branch Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Branch Code</Label>
                <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} maxLength={5} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Address / Contact Information</Label>
              <Textarea rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.name || !form.code} onClick={save}>{editing ? "Save Changes" : "Create Branch"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
