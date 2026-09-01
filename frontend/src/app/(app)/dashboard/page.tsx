import { redirect } from "next/navigation";

// The two-role navigation has no Dashboard: Calendar is the landing screen for
// both Admin and Physiotherapist, and the numbers live under Reports.
export default function DashboardRedirect() {
  redirect("/calendar");
}
