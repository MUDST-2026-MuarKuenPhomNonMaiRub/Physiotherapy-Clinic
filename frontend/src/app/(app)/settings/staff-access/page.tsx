"use client";

import { useMemo, useState } from "react";
import { Check, KeyRound, Minus, Pencil, Plus, Search, ShieldCheck, UserPlus } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { allRoles, roleDescriptions, roleLabels, roleStyles, rolePermissions } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AppUser, Permission, Role, Staff, StaffPosition } from "@/types";
import { toast } from "sonner";

const positions: StaffPosition[] = ["Physiotherapist", "Clinic Manager", "Assistant Therapist"];
const avatarColors = ["bg-[#1A4A2E]", "bg-[#2D6B45]", "bg-[#24BEE2]", "bg-[#586050]", "bg-[#F3AB3B]"];

/** Position is what the person does on the floor; role is what the software lets them do. */
const suggestedRoleForPosition: Record<StaffPosition, Role> = {
  "Clinic Manager": "ADMIN",
  Physiotherapist: "PHYSIOTHERAPIST",
  "Assistant Therapist": "PHYSIOTHERAPIST",
};

const permissionGroups: { label: string; keys: { key: Permission; label: string }[] }[] = [
  {
    label: "Patients",
    keys: [
      { key: "patient.view", label: "View patient records" },
      { key: "patient.create", label: "Register new patient" },
      { key: "patient.edit", label: "Edit patient details" },
    ],
  },
  {
    label: "Calendar & Appointments",
    keys: [
      { key: "appointment.view", label: "View calendar & appointments" },
      { key: "appointment.create", label: "Book appointment" },
      { key: "appointment.edit", label: "Update status / treatment note" },
      { key: "appointment.cancel", label: "Cancel or reschedule" },
    ],
  },
  {
    label: "Courses",
    keys: [
      { key: "course.view", label: "View course balances" },
      { key: "course.use", label: "Deduct a session" },
      { key: "course.transfer", label: "Transfer sessions between patients" },
    ],
  },
  {
    label: "Finance",
    keys: [
      { key: "checkout.create", label: "Take payment (checkout)" },
      { key: "transaction.view", label: "View transactions" },
      { key: "transaction.void", label: "Void a transaction" },
    ],
  },
  {
    label: "Reports",
    keys: [
      { key: "report.view", label: "Open reports" },
      { key: "report.view.all", label: "See clinic-wide figures (all staff, all branches)" },
      { key: "commission.view.own", label: "See own commission" },
      { key: "commission.view.all", label: "See everyone's commission" },
    ],
  },
  {
    label: "Administration",
    keys: [{ key: "settings.manage", label: "Manage clinic settings" }],
  },
];

function initials(nameEn: string): string {
  const parts = nameEn.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

interface FormState {
  name: string;
  nameEn: string;
  position: StaffPosition;
  phone: string;
  email: string;
  branchIds: string[];
  hasAccount: boolean;
  username: string;
  role: Role;
}

const emptyForm: FormState = {
  name: "",
  nameEn: "",
  position: "Physiotherapist",
  phone: "",
  email: "",
  branchIds: [],
  hasAccount: true,
  username: "",
  role: "PHYSIOTHERAPIST",
};

export default function StaffAccessPage() {
  const staff = useClinicStore((s) => s.staff);
  const users = useClinicStore((s) => s.users);
  const branches = useClinicStore((s) => s.branches);
  const addStaff = useClinicStore((s) => s.addStaff);
  const updateStaff = useClinicStore((s) => s.updateStaff);
  const toggleStaffStatus = useClinicStore((s) => s.toggleStaffStatus);
  const addUser = useClinicStore((s) => s.addUser);
  const updateUser = useClinicStore((s) => s.updateUser);
  const toggleUserStatus = useClinicStore((s) => s.toggleUserStatus);

  const [tab, setTab] = useState("people");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL" | "NO_ACCOUNT">("ALL");

  const accountByStaffId = useMemo(() => {
    const map = new Map<string, AppUser>();
    users.forEach((u) => { if (u.staffId) map.set(u.staffId, u); });
    return map;
  }, [users]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff
      .map((s) => ({ staff: s, account: accountByStaffId.get(s.id) ?? null }))
      .filter(({ staff: s, account }) => {
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          s.nameEn.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (account?.username.toLowerCase().includes(q) ?? false)
        );
      })
      .filter(({ account }) => {
        if (roleFilter === "ALL") return true;
        if (roleFilter === "NO_ACCOUNT") return !account;
        return account?.role === roleFilter;
      });
  }, [staff, accountByStaffId, query, roleFilter]);

  const counts = useMemo(() => {
    const withAccount = staff.filter((s) => accountByStaffId.has(s.id));
    return {
      total: staff.length,
      admins: withAccount.filter((s) => accountByStaffId.get(s.id)!.role === "ADMIN").length,
      physios: withAccount.filter((s) => accountByStaffId.get(s.id)!.role === "PHYSIOTHERAPIST").length,
      noAccount: staff.length - withAccount.length,
    };
  }, [staff, accountByStaffId]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(s: Staff) {
    const account = accountByStaffId.get(s.id) ?? null;
    setEditing(s);
    setForm({
      name: s.name,
      nameEn: s.nameEn,
      position: s.position,
      phone: s.phone,
      email: s.email,
      branchIds: s.branchIds,
      hasAccount: !!account,
      username: account?.username ?? "",
      role: account?.role ?? suggestedRoleForPosition[s.position],
    });
    setOpen(true);
  }

  function toggleBranch(id: string) {
    setForm((f) => ({
      ...f,
      branchIds: f.branchIds.includes(id) ? f.branchIds.filter((b) => b !== id) : [...f.branchIds, id],
    }));
  }

  const usernameTaken = users.some(
    (u) =>
      u.username.toLowerCase() === form.username.trim().toLowerCase() &&
      u.staffId !== editing?.id
  );
  const canSave =
    form.name.trim().length > 0 &&
    form.branchIds.length > 0 &&
    (!form.hasAccount || (form.username.trim().length > 0 && !usernameTaken));

  function save() {
    if (!canSave) return;
    const profile = {
      name: form.name.trim(),
      nameEn: form.nameEn.trim(),
      position: form.position,
      phone: form.phone.trim(),
      email: form.email.trim(),
      branchIds: form.branchIds,
    };

    if (editing) {
      updateStaff(editing.id, profile);
      const account = accountByStaffId.get(editing.id) ?? null;
      if (form.hasAccount) {
        const accountData = {
          username: form.username.trim(),
          displayName: profile.name,
          role: form.role,
          staffId: editing.id,
          branchIds: form.branchIds,
        };
        if (account) updateUser(account.id, accountData);
        else addUser({ ...accountData, password: "demo", status: "ACTIVE" });
      } else if (account) {
        // Access is revoked by deactivating the login, never by dropping the
        // record — transactions and commission still point at this person.
        if (account.status === "ACTIVE") toggleUserStatus(account.id);
      }
      toast.success(`${profile.name} updated`);
    } else {
      const staffId = `stf-${useClinicStore.getState().seq}`;
      addStaff({
        ...profile,
        status: "ACTIVE",
        avatarColor: avatarColors[staff.length % avatarColors.length],
      });
      if (form.hasAccount) {
        addUser({
          username: form.username.trim(),
          password: "demo",
          role: form.role,
          staffId,
          displayName: profile.name,
          branchIds: form.branchIds,
          status: "ACTIVE",
        });
      }
      toast.success(`${profile.name} added`);
    }
    setOpen(false);
  }

  return (
    <>
      <PageHeader
        title="Staff & Access"
        description="One record per person — their clinic profile and the login that goes with it"
        actions={
          tab === "people" ? (
            <Button onClick={openCreate}>
              <UserPlus className="h-4 w-4" /> Add Person
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="People" value={counts.total} />
        <SummaryTile label="Admins" value={counts.admins} tone="primary" />
        <SummaryTile label="Physiotherapists" value={counts.physios} tone="info" />
        <SummaryTile label="No login yet" value={counts.noAccount} tone="muted" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email or username…"
                className="h-9 pl-8"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
              <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All access levels</SelectItem>
                {allRoles.map((r) => (
                  <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                ))}
                <SelectItem value="NO_ACCOUNT">No login account</SelectItem>
              </SelectContent>
            </Select>
            <p className="ml-auto text-sm text-muted-foreground">{rows.length} of {staff.length} people</p>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No one matches this filter"
              action={<Button variant="outline" onClick={() => { setQuery(""); setRoleFilter("ALL"); }}>Clear filters</Button>}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Access Level</TableHead>
                      <TableHead>Login</TableHead>
                      <TableHead>Branches</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(({ staff: s, account }) => (
                      <TableRow key={s.id} className="[&>td]:py-3">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${s.avatarColor}`}>
                              {initials(s.nameEn || s.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{s.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{s.email || s.nameEn}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">{s.position}</Badge>
                        </TableCell>
                        <TableCell>
                          {account ? (
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleStyles[account.role]}`}>
                              {roleLabels[account.role]}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No access</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {account ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                              <KeyRound className="h-3 w-3" /> {account.username}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {s.branchIds.map((bid) => (
                              <Badge key={bid} variant="secondary" className="font-normal">
                                {branches.find((b) => b.id === bid)?.code}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge status={s.status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {account?.lastLogin ? formatDateTime(account.lastLogin) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Switch
                              checked={s.status === "ACTIVE"}
                              aria-label={`${s.status === "ACTIVE" ? "Deactivate" : "Activate"} ${s.name}`}
                              onCheckedChange={() => {
                                toggleStaffStatus(s.id);
                                // The login follows the person: suspending a staff
                                // member must also lock them out.
                                if (account) toggleUserStatus(account.id);
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            {allRoles.map((r) => (
              <div key={r} className="rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleStyles[r]}`}>
                    {roleLabels[r]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r === "ADMIN" ? counts.admins : counts.physios}{" "}
                    {(r === "ADMIN" ? counts.admins : counts.physios) === 1 ? "person" : "people"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{roleDescriptions[r]}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Area</TableHead>
                    <TableHead>Capability</TableHead>
                    {allRoles.map((r) => (
                      <TableHead key={r} className="w-40 text-center">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleStyles[r]}`}>
                          {roleLabels[r]}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionGroups.map((group, gi) =>
                    group.keys.map((k, i) => (
                      <TableRow key={k.key} className={gi % 2 === 1 ? "bg-muted/40" : undefined}>
                        {i === 0 && (
                          <TableCell rowSpan={group.keys.length} className="align-top font-medium text-foreground">
                            {group.label}
                          </TableCell>
                        )}
                        <TableCell className="whitespace-normal text-muted-foreground">{k.label}</TableCell>
                        {allRoles.map((r) => (
                          <TableCell key={r} className="text-center">
                            {rolePermissions[r].includes(k.key) ? (
                              <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success">
                                <Check className="h-3 w-3" strokeWidth={3} />
                                <span className="sr-only">Allowed</span>
                              </span>
                            ) : (
                              <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground/60">
                                <Minus className="h-3 w-3" strokeWidth={3} />
                                <span className="sr-only">Not allowed</span>
                              </span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            The matrix is fixed for this clinic — navigation, buttons and report scope throughout the
            system are filtered from it. Assign a person to a level on the People tab.
          </p>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add Person"}</DialogTitle>
            <DialogDescription>
              A person&apos;s clinic profile and their system access are set together.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-4">
              <SectionLabel>Staff profile</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name (TH)" required>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </Field>
                <Field label="Name (EN)">
                  <Input value={form.nameEn} onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))} />
                </Field>
              </div>
              <Field label="Position">
                <Select
                  value={form.position}
                  onValueChange={(v) =>
                    setForm((f) => {
                      const position = v as StaffPosition;
                      // Only pre-fill the access level while creating; on an existing
                      // person their assigned level is deliberate, so leave it alone.
                      return editing ? { ...f, position } : { ...f, position, role: suggestedRoleForPosition[position] };
                    })
                  }
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {positions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Phone">
                  <Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </Field>
                <Field label="Email">
                  <Input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </Field>
              </div>
              <Field label="Branches" required hint="Where this person works, and what their login can see.">
                <div className="flex flex-wrap gap-x-5 gap-y-2.5 rounded-xl border border-border p-3">
                  {branches.map((b) => (
                    <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={form.branchIds.includes(b.id)} onCheckedChange={() => toggleBranch(b.id)} />
                      {b.name}
                    </label>
                  ))}
                </div>
              </Field>
            </section>

            <section className="space-y-4 rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <SectionLabel>System access</SectionLabel>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.hasAccount
                      ? "This person can sign in to the clinic system."
                      : "No login — the person still appears on appointments, sales and commission."}
                  </p>
                </div>
                <Switch
                  checked={form.hasAccount}
                  aria-label="Give this person a login"
                  onCheckedChange={(v) => setForm((f) => ({ ...f, hasAccount: v }))}
                />
              </div>

              {form.hasAccount && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Username" required>
                    <Input
                      value={form.username}
                      autoComplete="off"
                      aria-invalid={usernameTaken || undefined}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    />
                    {usernameTaken && (
                      <p className="mt-1 text-xs text-destructive">That username is already taken.</p>
                    )}
                  </Field>
                  <Field label="Access level">
                    <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allRoles.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <p className="sm:col-span-2 text-xs leading-relaxed text-muted-foreground">
                    {roleDescriptions[form.role]}
                  </p>
                </div>
              )}
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!canSave} onClick={save}>
              {editing ? "Save Changes" : <><Plus className="h-4 w-4" /> Add Person</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "primary" | "info" | "muted";
}) {
  const valueTone =
    tone === "primary" ? "text-primary" : tone === "info" ? "text-[#1A9DBF]" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 font-heading text-2xl font-semibold ${valueTone}`}>{value}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{children}</p>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
