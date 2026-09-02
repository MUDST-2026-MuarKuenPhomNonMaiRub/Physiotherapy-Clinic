import { redirect } from "next/navigation";

// Folded into the Commission report, which is scoped to the signed-in
// physiotherapist unless they hold "report.view.all".
export default function MyCommissionRedirect() {
  redirect("/reports/commission");
}
