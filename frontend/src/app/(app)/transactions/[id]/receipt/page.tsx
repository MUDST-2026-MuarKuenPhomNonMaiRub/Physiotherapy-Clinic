"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { getPatientFullNameTh } from "@/lib/domain";
import { Forbidden } from "@/components/shared/forbidden";
import { ReceiptView } from "@/components/receipts/receipt-view";

export default function TransactionReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useSession();
  const transactions = useClinicStore((s) => s.transactions);
  const patients = useClinicStore((s) => s.patients);
  const branches = useClinicStore((s) => s.branches);
  const paymentMethods = useClinicStore((s) => s.paymentMethods);
  if (!can("transaction.view")) return <Forbidden />;
  const transaction = transactions.find((t) => t.id === id);
  if (!transaction) notFound();
  const patient = patients.find((p) => p.id === transaction.patientId);
  return <ReceiptView backHref={`/transactions/${id}`} data={{
    transaction,
    branch: branches.find((b) => b.id === transaction.branchId),
    patient: patient ? { name: getPatientFullNameTh(patient), hn: patient.hn, identity: patient.customerType === "FOREIGNER" ? patient.passport : patient.nationalId, phone: patient.phone, address: patient.address } : undefined,
    paymentMethod: paymentMethods.find((p) => p.id === transaction.paymentMethodId)?.name,
  }} />;
}
