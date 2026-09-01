"use client";

import { Banknote, CreditCard, Landmark, QrCode } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { PageHeader } from "@/components/shared/page-header";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const iconMap: Record<string, typeof Banknote> = { Banknote, Landmark, QrCode, CreditCard };

export default function PaymentMethodsSettingsPage() {
  const paymentMethods = useClinicStore((s) => s.paymentMethods);
  const togglePaymentMethod = useClinicStore((s) => s.togglePaymentMethod);

  return (
    <>
      <PageHeader
        title="Payment Methods"
        description="Disabled payment methods will not appear as an option during checkout"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {paymentMethods.map((pm) => {
          const Icon = iconMap[pm.icon] ?? Banknote;
          return (
            <div
              key={pm.id}
              className={`flex items-center justify-between rounded-xl border p-5 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${
                pm.enabled ? "border-primary/20 bg-primary/[0.03]" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${pm.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{pm.name}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${pm.enabled ? "bg-success" : "bg-muted-foreground"}`} />
                    <p className="text-xs text-muted-foreground">
                      {pm.enabled ? "Visible at checkout" : "Hidden at checkout"}
                    </p>
                  </div>
                </div>
              </div>
              <Switch
                checked={pm.enabled}
                onCheckedChange={() => {
                  togglePaymentMethod(pm.id);
                  toast.success(`${pm.name} ${pm.enabled ? "disabled" : "enabled"}`);
                }}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
