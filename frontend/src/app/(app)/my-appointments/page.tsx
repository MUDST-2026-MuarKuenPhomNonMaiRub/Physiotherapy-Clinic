import { redirect } from "next/navigation";

// Folded into the shared Calendar, which opens on the signed-in
// physiotherapist's own column.
export default function MyAppointmentsRedirect() {
  redirect("/calendar");
}
