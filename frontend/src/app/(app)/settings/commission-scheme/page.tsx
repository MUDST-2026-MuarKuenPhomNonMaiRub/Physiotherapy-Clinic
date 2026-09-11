"use client";

import { useEffect, useState } from "react";
import { Plus, TrendingUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createCommissionScheme, listCommissionSchemes } from "@/lib/api/clinic-api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { CommissionScheme } from "@/types";

type TierDraft = { order: number; min: string; max: string; rate: string };

const emptyTier = (order: number): TierDraft => ({ order, min: "", max: "", rate: "" });

/**
 * The monthly-course-sales tier table a Seller's rate is looked up from at
 * close. Creating a new scheme here starts a new version — an existing,
 * already-closed month keeps whatever rate it was frozen at (see Tier
 * Versioning in the requirement doc), so this never edits history.
 */
export default function CommissionSchemePage() {
  const [schemes, setSchemes] = useState<CommissionScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("DEFAULT");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [tiers, setTiers] = useState<TierDraft[]>([emptyTier(1)]);

  async function load() {
    setLoading(true);
    try {
      const rows = await listCommissionSchemes();
      setSchemes(rows.sort((a, b) => b.version - a.version));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load commission tiers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // load() only sets state after its own await, inside the fetch's
    // resolution — not synchronously on this render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  function openCreate() {
    setCode("DEFAULT");
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setTiers([emptyTier(1)]);
    setOpen(true);
  }

  function addTierRow() {
    setTiers((t) => [...t, emptyTier(t.length + 1)]);
  }

  function removeTierRow(index: number) {
    setTiers((t) => t.filter((_, i) => i !== index).map((tier, i) => ({ ...tier, order: i + 1 })));
  }

  async function save() {
    const parsed = tiers.map((t) => ({
      order: t.order,
      min: Number(t.min || 0),
      max: t.max.trim() === "" ? null : Number(t.max),
      rate: Number(t.rate || 0) / 100,
    }));
    if (parsed.length === 0) {
      toast.error("Add at least one tier");
      return;
    }
    try {
      await createCommissionScheme({ code, effectiveFrom, tiers: parsed });
      toast.success("New commission scheme version created");
      setOpen(false);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the scheme");
    }
  }

  return (
    <>
      <PageHeader
        title="Commission Tiers"
        description="The monthly course-sales tier a Seller's rate is drawn from at close. Saving here always starts a new version — it never rewrites a rate already frozen on a closed month."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> New Version</Button>}
      />

      {!loading && schemes.length === 0 && (
        <EmptyState icon={TrendingUp} title="No commission scheme configured" action={<Button onClick={openCreate}>New Version</Button>} />
      )}

      {schemes.map((scheme) => (
        <div key={`${scheme.code}-${scheme.version}`} className="mb-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <span className="font-medium text-foreground">{scheme.code}</span>
              <Badge variant="outline" className="ml-2">v{scheme.version}</Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              Effective {formatDate(scheme.effectiveFrom)}
              {scheme.effectiveTo ? ` – ${formatDate(scheme.effectiveTo)}` : " onward"}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Monthly Course Sales</TableHead>
                <TableHead className="text-right">Commission Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scheme.tiers
                .sort((a, b) => a.order - b.order)
                .map((tier) => (
                  <TableRow key={tier.order}>
                    <TableCell>{tier.order}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {tier.min.toLocaleString()} – {tier.max == null ? "∞" : tier.max.toLocaleString()} บาท
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {(tier.rate * 100).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Commission Scheme Version</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Scheme Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Effective From</Label>
                <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tiers</Label>
                <Button variant="outline" size="sm" onClick={addTierRow}><Plus className="h-3.5 w-3.5" /> Tier</Button>
              </div>
              {tiers.map((tier, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Min sales</Label>
                    <Input type="number" value={tier.min} onChange={(e) => setTiers((t) => t.map((x, i) => (i === index ? { ...x, min: e.target.value } : x)))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Max sales (blank = no limit)</Label>
                    <Input type="number" value={tier.max} onChange={(e) => setTiers((t) => t.map((x, i) => (i === index ? { ...x, max: e.target.value } : x)))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Rate %</Label>
                    <Input type="number" step="0.01" value={tier.rate} onChange={(e) => setTiers((t) => t.map((x, i) => (i === index ? { ...x, rate: e.target.value } : x)))} />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeTierRow(index)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save New Version</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
