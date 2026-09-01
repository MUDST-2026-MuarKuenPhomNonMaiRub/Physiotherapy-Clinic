import type { PaymentMethod } from "@/types";

export const paymentMethods: PaymentMethod[] = [
  { id: "pm-cash", name: "Cash", icon: "Banknote", enabled: true },
  { id: "pm-transfer", name: "Transfer", icon: "Landmark", enabled: true },
  { id: "pm-qr", name: "QR Payment", icon: "QrCode", enabled: true },
  { id: "pm-card", name: "Credit Card", icon: "CreditCard", enabled: false },
];

export function getPaymentMethodById(id: string): PaymentMethod | undefined {
  return paymentMethods.find((p) => p.id === id);
}
