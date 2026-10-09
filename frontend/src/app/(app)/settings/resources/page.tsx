"use client";

import { useState } from "react";
import { Building2, DoorOpen, LayoutGrid, Pencil, Plus, Sparkles } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
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
import type { ResourceRoom } from "@/types";
import { toast } from "sonner";

const resourceTypes = ["Treatment Room", "Open Area", "Specialty Room"];
const resourceTypeIcon: Record<string, typeof DoorOpen> = {
  "Treatment Room": DoorOpen,
  "Open Area": LayoutGrid,
  "Specialty Room": Sparkles,
};

export default function ResourcesSettingsPage() {
  const resources = useClinicStore((s) => s.resources);
  const branches = useClinicStore((s) => s.branches);
  const addResource = useClinicStore((s) => s.addResource);
  const updateResource = useClinicStore((s) => s.updateResource);
  const toggleResourceStatus = useClinicStore((s) => s.toggleResourceStatus);

  const emptyForm = { name: "", type: resourceTypes[0], branchId: branches[0]?.id ?? "" };
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceRoom | null>(null);
  const [form, setForm] = useState(emptyForm);

  function openCreate() { setEditing(null); setForm(emptyForm); setOpen(true); }
  function openEdit(r: ResourceRoom) { setEditing(r); setForm({ name: r.name, type: r.type, branchId: r.branchId }); setOpen(true); }
  async function save() {
    if (!form.name) return;
    try {
      if (editing) { await updateResource(editing.id, form); toast.success("Resource updated"); }
      else { await addResource({ ...form, status: "ACTIVE" }); toast.success("Resource created"); }
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the change");
    }
  }

  async function toggleStatus(id: string) {
    try {
      await toggleResourceStatus(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the status");
    }
  }

  return (
    <>
      <PageHeader
        title="Rooms / Resources"
        description="Treatment rooms and resources available for scheduling appointments"
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Resource</Button>}
      />

      {resources.length === 0 ? (
        <EmptyState icon={DoorOpen} title="No resources yet" action={<Button onClick={openCreate}>Add Resource</Button>} />
      ) : (
        <div className="space-y-6">
          {branches.map((branch) => {
            const branchResources = resources.filter((r) => r.branchId === branch.id);
            if (branchResources.length === 0) return null;
            return (
              <div key={branch.id}>
                <div className="mb-2.5 flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {branch.name} <span className="font-mono normal-case">({branch.code})</span>
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {branchResources.map((r) => {
                    const Icon = resourceTypeIcon[r.type] ?? DoorOpen;
                    return (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{r.name}</p>
                            <p className="text-xs text-muted-foreground">{r.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.status} className="hidden lg:inline-flex" />
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Switch checked={r.status === "ACTIVE"} onCheckedChange={() => void toggleStatus(r.id)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Resource" : "Add Resource"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Resource Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {resourceTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={form.branchId} onValueChange={(v) => setForm((f) => ({ ...f, branchId: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.name} onClick={save}>{editing ? "Save Changes" : "Add Resource"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
