"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Pencil, Plus, Share2, ShieldCheck, Users } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MasterDataItem } from "@/types";
import { toast } from "sonner";

const categories: { value: MasterDataItem["category"]; label: string; description: string; icon: LucideIcon }[] = [
  { value: "CUSTOMER_GROUP", label: "Customer Group", description: "Segments used on patient registration", icon: Users },
  { value: "REFERRAL_CHANNEL", label: "Referral Channel", description: "How patients heard about the clinic", icon: Share2 },
  { value: "INSURANCE_COMPANY", label: "Insurance Company", description: "Insurers accepted at checkout", icon: ShieldCheck },
];

export default function MasterDataSettingsPage() {
  const masterData = useClinicStore((s) => s.masterData);
  const addMasterDataItem = useClinicStore((s) => s.addMasterDataItem);
  const updateMasterDataItem = useClinicStore((s) => s.updateMasterDataItem);
  const toggleMasterDataItemStatus = useClinicStore((s) => s.toggleMasterDataItemStatus);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MasterDataItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<MasterDataItem["category"]>("CUSTOMER_GROUP");
  const [value, setValue] = useState("");

  function openCreate(cat: MasterDataItem["category"]) {
    setEditing(null); setActiveCategory(cat); setValue(""); setOpen(true);
  }
  function openEdit(item: MasterDataItem) {
    setEditing(item); setActiveCategory(item.category); setValue(item.value); setOpen(true);
  }
  function save() {
    if (!value.trim()) return;
    if (editing) { updateMasterDataItem(editing.id, { value }); toast.success("Updated"); }
    else { addMasterDataItem({ category: activeCategory, value, status: "ACTIVE" }); toast.success("Added"); }
    setOpen(false);
  }

  return (
    <>
      <PageHeader title="Master Data" description="Manage shared dropdown values used across patient registration and checkout" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {categories.map((c) => {
          const items = masterData.filter((m) => m.category === c.value);
          const activeCount = items.filter((m) => m.status === "ACTIVE").length;
          const Icon = c.icon;
          return (
            <div key={c.value} className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{activeCount} active</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openCreate(c.value)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{c.description}</p>

              <div className="mt-4 flex-1 border-t border-border pt-4">
                {items.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => openCreate(c.value)}
                    className="w-full rounded-lg border border-dashed border-border py-4 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    No values yet — add the first one
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {items.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border py-1 pr-1 pl-3 transition-colors",
                          m.status === "ACTIVE"
                            ? "border-primary/20 bg-primary/5"
                            : "border-border bg-muted/40"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className={cn(
                            "flex items-center gap-1 text-xs font-medium hover:underline",
                            m.status === "ACTIVE" ? "text-foreground" : "text-muted-foreground line-through"
                          )}
                        >
                          {m.value}
                          <Pencil className="h-2.5 w-2.5 opacity-50" />
                        </button>
                        <Switch
                          checked={m.status === "ACTIVE"}
                          onCheckedChange={() => toggleMasterDataItemStatus(m.id)}
                          className="scale-[0.65]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Value" : "Add Value"}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Value</Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!value.trim()} onClick={save}>{editing ? "Save Changes" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
