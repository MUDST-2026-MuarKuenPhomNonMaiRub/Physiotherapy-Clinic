"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { getMasterDataByCategory } from "@/lib/domain";
import type { CustomerType, Gender } from "@/types";
import { PageHeader } from "@/components/shared/page-header";
import { Forbidden } from "@/components/shared/forbidden";
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
}

export default function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = useSession();
  const patients = useClinicStore((s) => s.patients);
  const branches = useClinicStore((s) => s.branches);
  const updatePatient = useClinicStore((s) => s.updatePatient);
  const masterData = useClinicStore((s) => s.masterData);
  const customerGroups = getMasterDataByCategory(masterData, "CUSTOMER_GROUP").filter((m) => m.status === "ACTIVE");
  const referralChannels = getMasterDataByCategory(masterData, "REFERRAL_CHANNEL").filter((m) => m.status === "ACTIVE");
  const insuranceCompanies = getMasterDataByCategory(masterData, "INSURANCE_COMPANY").filter((m) => m.status === "ACTIVE");

  const patient = patients.find((p) => p.id === id);
  if (!patient) notFound();

  const branch = branches.find((b) => b.id === patient.registrationBranchId);

  const [form, setForm] = useState<FormState>({
    customerType: patient.customerType,
    titleTh: patient.titleTh,
    firstNameTh: patient.firstNameTh,
    lastNameTh: patient.lastNameTh,
    firstNameEn: patient.firstNameEn,
    lastNameEn: patient.lastNameEn,
    nickname: patient.nickname,
    gender: patient.gender,
    dob: patient.dob,
    bloodGroup: patient.bloodGroup,
    nationality: patient.nationality,
    nationalId: patient.nationalId ?? "",
    passport: patient.passport ?? "",
    phone: patient.phone,
    address: patient.address,
    customerGroup: patient.customerGroup,
    referralChannel: patient.referralChannel,
    insuranceCompany: patient.insuranceCompany,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!can("patient.edit")) return <Forbidden homeHref={`/patients/${patient.id}`} />;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (form.customerType === "THAI") {
      if (!form.firstNameTh) e.firstNameTh = "Required";
      if (!form.lastNameTh) e.lastNameTh = "Required";
      if (!form.nationalId) e.nationalId = "Required";
    } else {
      if (!form.firstNameEn) e.firstNameEn = "Required";
      if (!form.lastNameEn) e.lastNameEn = "Required";
      if (!form.passport) e.passport = "Required";
    }
    if (!form.dob) e.dob = "Required";
    if (!form.phone) e.phone = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await updatePatient(patient!.id, {
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
      });
      toast.success("Patient details updated");
      router.push(`/patients/${patient!.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save these details");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Link href={`/patients/${patient.id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Patient
      </Link>

      <PageHeader
        title={`Edit Patient — ${patient.hn}`}
        description="Update patient registration details"
        actions={
          <Button variant="outline" onClick={() => router.push(`/patients/${patient.id}`)}>
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-5 pb-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Customer Type</Label>
              <RadioGroup
                value={form.customerType}
                onValueChange={(v) => update("customerType", v as CustomerType)}
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
                  <div className="space-y-1.5 sm:col-span-1.5">
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
                <Label>Nationality</Label>
                <Input value={form.nationality} onChange={(e) => update("nationality", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identification</CardTitle>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registration Branch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs space-y-1.5">
              <Label>Branch</Label>
              <div className="flex h-8 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
                {branch ? `${branch.name} (${branch.code})` : "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                Registration branch is locked because it&apos;s encoded in this patient&apos;s HN ({patient.hn}).
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(`/patients/${patient.id}`)}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
        </div>
      </form>
    </>
  );
}
