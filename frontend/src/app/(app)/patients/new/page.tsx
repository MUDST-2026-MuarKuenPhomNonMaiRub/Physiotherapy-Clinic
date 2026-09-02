"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, CheckCircle2, Fingerprint, Tags, User, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { getMasterDataByCategory } from "@/lib/domain";
import { previewHN } from "@/lib/domain";
import { today } from "@/lib/domain";
import type { CustomerType, Gender, Patient } from "@/types";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

const bloodGroups = ["A", "B", "AB", "O"];

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      {children}
    </CardTitle>
  );
}

interface FormState {
  customerType: CustomerType;
  titleTh: string;
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn: string;
  lastNameEn: string;
  nickname: string;
  gender: Gender;
  dob: string;
  bloodGroup: string;
  nationality: string;
  nationalId: string;
  passport: string;
  phone: string;
  address: string;
  customerGroup: string;
  referralChannel: string;
  insuranceCompany: string;
  registrationBranchId: string;
}

export default function NewPatientPage() {
  const router = useRouter();
  const { user, activeBranchId } = useSession();
  const branches = useClinicStore((s) => s.branches);
  const patients = useClinicStore((s) => s.patients);
  const addPatient = useClinicStore((s) => s.addPatient);
  const masterData = useClinicStore((s) => s.masterData);
  const customerGroups = getMasterDataByCategory(masterData, "CUSTOMER_GROUP").filter((m) => m.status === "ACTIVE");
  const referralChannels = getMasterDataByCategory(masterData, "REFERRAL_CHANNEL").filter((m) => m.status === "ACTIVE");
  const insuranceCompanies = getMasterDataByCategory(masterData, "INSURANCE_COMPANY").filter((m) => m.status === "ACTIVE");
  const accessibleBranches = branches.filter((b) => user?.branchIds.includes(b.id) && b.status === "ACTIVE");

  const [form, setForm] = useState<FormState>({
    customerType: "THAI",
    titleTh: "นาย",
    firstNameTh: "",
    lastNameTh: "",
    firstNameEn: "",
    lastNameEn: "",
    nickname: "",
    gender: "MALE",
    dob: "",
    bloodGroup: "O",
    nationality: "Thai",
    nationalId: "",
    passport: "",
    phone: "",
    address: "",
    customerGroup: customerGroups[0]?.value ?? "",
    referralChannel: referralChannels[0]?.value ?? "",
    insuranceCompany: insuranceCompanies[0]?.value ?? "",
    registrationBranchId: activeBranchId ?? accessibleBranches[0]?.id ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);

  // A preview only — the server mints the real HN when the record is saved.
  const hnPreview = useMemo(() => {
    const branch = branches.find((b) => b.id === form.registrationBranchId);
    if (!branch) return null;
    const now = new Date(`${today()}T00:00:00`);
    const prefix = `${String(now.getFullYear() % 100).padStart(2, "0")}${branch.code}${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
    const sameMonth = patients.filter(
      (p) => p.registrationBranchId === form.registrationBranchId && p.hn.startsWith(prefix)
    );
    return previewHN(branch.code, sameMonth.length + 1);
  }, [form.registrationBranchId, branches, patients]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (form.customerType === "THAI") {
      if (!form.firstNameTh) e.firstNameTh = "Required";
      if (!form.lastNameTh) e.lastNameTh = "Required";
      if (!form.nationalId || form.nationalId.length < 13) e.nationalId = "Enter a valid 13-digit National ID";
    } else {
      if (!form.firstNameEn) e.firstNameEn = "Required";
      if (!form.lastNameEn) e.lastNameEn = "Required";
      if (!form.passport) e.passport = "Required";
      if (!form.nationality) e.nationality = "Required";
    }
    if (!form.dob) e.dob = "Required";
    if (!form.phone) e.phone = "Required";
    if (!form.registrationBranchId) e.registrationBranchId = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const patient = await addPatient({
      customerType: form.customerType,
      titleTh: form.titleTh,
      firstNameTh: form.firstNameTh || form.firstNameEn,
      lastNameTh: form.lastNameTh || form.lastNameEn,
      firstNameEn: form.firstNameEn || form.firstNameTh,
      lastNameEn: form.lastNameEn || form.lastNameTh,
      nickname: form.nickname,
      gender: form.gender,
      dob: form.dob,
      bloodGroup: form.bloodGroup,
      nationality: form.nationality,
      nationalId: form.customerType === "THAI" ? form.nationalId : undefined,
      passport: form.customerType === "FOREIGNER" ? form.passport : undefined,
      phone: form.phone,
      address: form.address,
      customerGroup: form.customerGroup,
      referralChannel: form.referralChannel,
      insuranceCompany: form.insuranceCompany,
      registrationBranchId: form.registrationBranchId,
      });
      setCreated(patient);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to register this patient");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <p className="text-lg font-semibold text-foreground">Patient Registered Successfully</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {created.titleTh}
          {created.firstNameTh} {created.lastNameTh} has been added to the system.
        </p>
        <div className="mt-5 rounded-xl border border-border bg-card px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hospital Number (HN)</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-wider text-primary">{created.hn}</p>
        </div>
        <div className="mt-6 flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/patients/${created.id}`}>
              <UserRound className="h-4 w-4" /> View Patient
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/appointments/new?patientId=${created.id}`}>
              <CalendarPlus className="h-4 w-4" /> Create Appointment
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Register New Patient"
        description="Fill in patient details to generate a Hospital Number (HN)"
        actions={
          <Button variant="outline" onClick={() => router.push("/patients")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-5 pb-10">
        <Card className="shadow-xs">
          <CardHeader>
            <SectionTitle icon={User}>Personal Information</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Customer Type</Label>
              <RadioGroup
                value={form.customerType}
                onValueChange={(v) => {
                  const customerType = v as CustomerType;
                  setForm((f) => ({
                    ...f,
                    customerType,
                    nationality: customerType === "THAI" ? "Thai" : f.nationality === "Thai" ? "" : f.nationality,
                  }));
                }}
                className="flex gap-4"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="THAI" /> Thai
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="FOREIGNER" /> Foreigner
                </label>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Select value={form.titleTh} onValueChange={(v) => update("titleTh", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="นาย">นาย (Mr.)</SelectItem>
                    <SelectItem value="นาง">นาง (Mrs.)</SelectItem>
                    <SelectItem value="นางสาว">นางสาว (Ms.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.customerType === "THAI" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Thai First Name <span className="text-destructive">*</span></Label>
                    <Input value={form.firstNameTh} onChange={(e) => update("firstNameTh", e.target.value)} autoComplete="given-name" />
                    {errors.firstNameTh && <p className="text-xs text-destructive">{errors.firstNameTh}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Thai Last Name <span className="text-destructive">*</span></Label>
                    <Input value={form.lastNameTh} onChange={(e) => update("lastNameTh", e.target.value)} autoComplete="family-name" />
                    {errors.lastNameTh && <p className="text-xs text-destructive">{errors.lastNameTh}</p>}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>First Name (EN) <span className="text-destructive">*</span></Label>
                    <Input value={form.firstNameEn} onChange={(e) => update("firstNameEn", e.target.value)} autoComplete="given-name" />
                    {errors.firstNameEn && <p className="text-xs text-destructive">{errors.firstNameEn}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name (EN) <span className="text-destructive">*</span></Label>
                    <Input value={form.lastNameEn} onChange={(e) => update("lastNameEn", e.target.value)} autoComplete="family-name" />
                    {errors.lastNameEn && <p className="text-xs text-destructive">{errors.lastNameEn}</p>}
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label>Nickname</Label>
                <Input value={form.nickname} onChange={(e) => update("nickname", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => update("gender", v as Gender)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date of Birth <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)} autoComplete="bday" />
                {errors.dob && <p className="text-xs text-destructive">{errors.dob}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Blood Group</Label>
                <Select value={form.bloodGroup} onValueChange={(v) => update("bloodGroup", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {bloodGroups.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nationality {form.customerType === "FOREIGNER" && <span className="text-destructive">*</span>}</Label>
                <Input value={form.nationality} onChange={(e) => update("nationality", e.target.value)} placeholder={form.customerType === "FOREIGNER" ? "e.g. American, Japanese" : undefined} />
                {errors.nationality && <p className="text-xs text-destructive">{errors.nationality}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader>
            <SectionTitle icon={Fingerprint}>Identification &amp; Contact</SectionTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {form.customerType === "THAI" ? (
              <div className="space-y-1.5">
                <Label>National ID</Label>
                <Input
                  value={form.nationalId}
                  maxLength={13}
                  onChange={(e) => update("nationalId", e.target.value.replace(/\D/g, ""))}
                  placeholder="13-digit number"
                />
                {errors.nationalId && <p className="text-xs text-destructive">{errors.nationalId}</p>}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Passport Number <span className="text-destructive">*</span></Label>
                <Input value={form.passport} onChange={(e) => update("passport", e.target.value)} autoComplete="off" />
                {errors.passport && <p className="text-xs text-destructive">{errors.passport}</p>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Phone <span className="text-destructive">*</span></Label>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="08X-XXX-XXXX"
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => update("address", e.target.value)} rows={2} autoComplete="street-address" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader>
            <SectionTitle icon={Tags}>Customer &amp; Registration</SectionTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Customer Group</Label>
              <Select value={form.customerGroup} onValueChange={(v) => update("customerGroup", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {customerGroups.map((c) => <SelectItem key={c.id} value={c.value}>{c.value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Referral Channel</Label>
              <Select value={form.referralChannel} onValueChange={(v) => update("referralChannel", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {referralChannels.map((c) => <SelectItem key={c.id} value={c.value}>{c.value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Insurance Company</Label>
              <Select value={form.insuranceCompany} onValueChange={(v) => update("insuranceCompany", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {insuranceCompanies.map((c) => <SelectItem key={c.id} value={c.value}>{c.value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Branch <span className="text-destructive">*</span></Label>
              <Select value={form.registrationBranchId} onValueChange={(v) => update("registrationBranchId", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accessibleBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.registrationBranchId && <p className="text-xs text-destructive">{errors.registrationBranchId}</p>}
            </div>
            {hnPreview && (
              <div className="flex items-center gap-3 rounded-lg bg-primary/5 px-3 py-2 sm:col-span-2 lg:col-span-4">
                <span className="text-xs font-medium text-muted-foreground">HN Preview</span>
                <span className="font-mono text-sm font-semibold tracking-wider text-primary">{hnPreview}</span>
                <span className="text-xs text-muted-foreground">— generated from branch, month and running number</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/patients")}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save & Generate HN"}</Button>
        </div>
      </form>
    </>
  );
}
