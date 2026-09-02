import {
  ArrowLeftRight,
  Banknote,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Database,
  DoorOpen,
  Package,
  Percent,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const navIconMap: Record<string, LucideIcon> = {
  ArrowLeftRight,
  Banknote,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Database,
  DoorOpen,
  Package,
  Percent,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = navIconMap[name] ?? Users;
  return <Icon className={className} />;
}
