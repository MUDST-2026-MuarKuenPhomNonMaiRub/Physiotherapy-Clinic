"use client";

import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Pencil, Plus, Share2, ShieldCheck, Tags, Trash2, Users } from "lucide-react";
import { createMasterDataCategory, listMasterDataCategories, updateMasterDataCategory } from "@/lib/api/clinic-api";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MasterDataCategory, MasterDataItem } from "@/types";
import { toast } from "sonner";
import { useLanguage } from "@/components/i18n/language-provider";

const categoryIcons: Record<string, LucideIcon> = { CUSTOMER_GROUP: Users, REFERRAL_CHANNEL: Share2, INSURANCE_COMPANY: ShieldCheck };

export default function MasterDataSettingsPage() {
  const { t } = useLanguage();
  const masterData = useClinicStore((s) => s.masterData);
  const addMasterDataItem = useClinicStore((s) => s.addMasterDataItem);
  const updateMasterDataItem = useClinicStore((s) => s.updateMasterDataItem);
  const toggleMasterDataItemStatus = useClinicStore((s) => s.toggleMasterDataItemStatus);
  const deleteMasterDataItem = useClinicStore((s) => s.deleteMasterDataItem);
  const deleteMasterDataCategory = useClinicStore((s) => s.deleteMasterDataCategory);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MasterDataItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<MasterDataItem["category"]>("CUSTOMER_GROUP");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<MasterDataCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryError, setCategoryError] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MasterDataCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [deleting, setDeleting] = useState<{ kind: "category" | "value"; id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const duplicateCategory = categories.some((c) => c.code !== editingCategory?.code && c.name.trim().toLocaleLowerCase() === categoryName.trim().toLocaleLowerCase());
  const loadCategories = useCallback(async () => {
    setLoadingCategories(true); setCategoryError("");
    try { setCategories(await listMasterDataCategories()); }
    catch (error) { setCategoryError(error instanceof Error ? error.message : "Could not load categories"); }
    finally { setLoadingCategories(false); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    listMasterDataCategories().then((data) => { if (!cancelled) setCategories(data); })
      .catch((error: unknown) => { if (!cancelled) setCategoryError(error instanceof Error ? error.message : "Could not load categories"); })
      .finally(() => { if (!cancelled) setLoadingCategories(false); });
    return () => { cancelled = true; };
  }, []);

  function openCategory(category?: MasterDataCategory) {
    setEditingCategory(category ?? null); setCategoryName(category?.name ?? "");
    setCategoryDescription(category?.description ?? ""); setCategoryOpen(true);
  }

  async function saveCategory() {
    if (savingCategory || !categoryName.trim() || duplicateCategory) return;
    setSavingCategory(true);
    try {
      const data = { name: categoryName.trim(), description: categoryDescription.trim() };
      const category = editingCategory ? await updateMasterDataCategory(editingCategory.code, data) : await createMasterDataCategory(data);
      setCategories((previous) => editingCategory ? previous.map((c) => c.code === category.code ? category : c) : [...previous, category]);
      setCategoryOpen(false); toast.success("Category saved");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save the category"); }
    finally { setSavingCategory(false); }
  }

  function openCreate(cat: MasterDataItem["category"]) {
    setEditing(null); setActiveCategory(cat); setValue(""); setOpen(true);
  }
  function openEdit(item: MasterDataItem) {
    setEditing(item); setActiveCategory(item.category); setValue(item.value); setOpen(true);
  }
  async function save() {
    if (!value.trim() || saving) return;
    setSaving(true);
    try {
      if (editing) { await updateMasterDataItem(editing.id, { value: value.trim() }); toast.success("Updated"); }
      else { await addMasterDataItem({ category: activeCategory, value: value.trim(), status: "ACTIVE" }); toast.success("Added"); }
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the change");
    } finally { setSaving(false); }
  }

  async function toggleStatus(id: string) {
    try {
      await toggleMasterDataItemStatus(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the status");
    }
  }

  return (
    <>
      <PageHeader title="Master Data" description="Manage shared categories and values. Add categories as the clinic grows."
        actions={<Button disabled={loadingCategories || !!categoryError} onClick={() => openCategory()}><Plus className="h-4 w-4" />Add Category</Button>} />
      {loadingCategories && <p className="mb-4 text-sm text-muted-foreground">Loading categories…</p>}
      {categoryError && <div role="alert" className="mb-4 rounded-lg border border-destructive/30 p-4 text-sm"><p>{categoryError}</p><Button variant="outline" className="mt-2" onClick={() => void loadCategories()}>Try Again</Button></div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {categories.map((c) => {
          const items = masterData.filter((m) => m.category === c.code);
          const activeCount = items.filter((m) => m.status === "ACTIVE").length;
          const Icon = categoryIcons[c.code] ?? Tags;
          return (
            <div key={c.code} className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="break-words text-sm font-semibold text-foreground">{t(c.name)}</h2>
                    <p className="text-xs text-muted-foreground">{t(`${activeCount} active`)}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={t(`Edit category ${c.name}`)} onClick={() => openCategory(c)}><Pencil className="h-4 w-4" /></Button>
                {!c.builtIn && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" aria-label={t(`Delete category ${c.name}`)} onClick={() => setDeleting({ kind: "category", id: c.code, name: c.name })}><Trash2 className="h-4 w-4" /></Button>}
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={t(`Add value to ${c.name}`)} onClick={() => openCreate(c.code)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t(c.description)}</p>
              {!c.builtIn && <p className="mt-2 text-xs text-muted-foreground">Custom category • not connected to other forms yet</p>}

              <div className="mt-4 flex-1 border-t border-border pt-4">
                {items.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => openCreate(c.code)}
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
                          aria-label={t(`Enable ${m.value}`)}
                          checked={m.status === "ACTIVE"}
                          onCheckedChange={() => void toggleStatus(m.id)}
                          className="scale-[0.65]"
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" aria-label={t(`Delete value ${m.value}`)} onClick={() => setDeleting({ kind: "value", id: m.id, name: m.value })}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!loadingCategories && !categoryError && <button type="button" onClick={() => openCategory()} className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"><Plus className="h-6 w-6" />Add New Category</button>}
      </div>

      <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Value" : "Add Value"}</DialogTitle></DialogHeader>
          <DialogDescription>{categories.find((c) => c.code === activeCategory)?.name}</DialogDescription>
          <div className="space-y-1.5">
            <Label htmlFor="master-data-value">Value</Label>
            <Input id="master-data-value" maxLength={200} disabled={saving} value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={saving || !value.trim()} onClick={save}>{saving ? "Saving…" : editing ? "Save Changes" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(next) => { if (!next && !removing) setDeleting(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{deleting?.kind === "category" ? "Delete Category and All Values?" : "Delete Value?"}</DialogTitle><DialogDescription>{deleting?.kind === "category" ? t(`Remove “${deleting.name}” and every value in this category from new selections. Existing historical records remain unchanged.`) : t(`Remove “${deleting?.name ?? ""}” from new selections. Existing historical records remain unchanged.`)}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" disabled={removing} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={removing} onClick={async () => {
            if (!deleting || removing) return;
            setRemoving(true);
            try {
              if (deleting.kind === "category") { await deleteMasterDataCategory(deleting.id); setCategories((previous) => previous.filter((c) => c.code !== deleting.id)); }
              else await deleteMasterDataItem(deleting.id);
              setDeleting(null); toast.success("Deleted");
            } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete the item"); }
            finally { setRemoving(false); }
          }}>{removing ? "Deleting…" : "Confirm Delete"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={categoryOpen} onOpenChange={(next) => { if (!savingCategory) setCategoryOpen(next); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle><DialogDescription>A new category gets its own card for values. It is not automatically added to other forms.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveCategory(); }}>
            <div className="space-y-2"><Label htmlFor="category-name">Category Name</Label><Input id="category-name" maxLength={120} required disabled={savingCategory} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="For example: Membership Type" />{duplicateCategory && <p role="alert" className="text-xs text-destructive">This category name already exists.</p>}</div>
            <div className="space-y-2"><Label htmlFor="category-description">Description (optional)</Label><Input id="category-description" maxLength={300} disabled={savingCategory} value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} /></div>
            <DialogFooter><Button type="button" variant="outline" disabled={savingCategory} onClick={() => setCategoryOpen(false)}>Cancel</Button><Button type="submit" disabled={savingCategory || !categoryName.trim() || duplicateCategory}>{savingCategory ? "Saving…" : "Save Category"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
