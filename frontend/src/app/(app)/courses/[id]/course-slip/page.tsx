"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { CourseSlipView, type CourseSlipRow } from "@/components/course-slip/course-slip-view";
import { Forbidden } from "@/components/shared/forbidden";
import { useSession } from "@/lib/auth/use-session";
import { getPatientFullNameTh, remainingSessions } from "@/lib/domain";
import { useClinicStore } from "@/lib/store/clinic-store";

export default function CourseSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useSession();
  const patients = useClinicStore((state) => state.patients);
  const branches = useClinicStore((state) => state.branches);
  const staff = useClinicStore((state) => state.staff);
  const appointments = useClinicStore((state) => state.appointments);
  const transactions = useClinicStore((state) => state.transactions);
  const patientCourses = useClinicStore((state) => state.patientCourses);
  const courseTemplates = useClinicStore((state) => state.courseTemplates);
  const courseLedger = useClinicStore((state) => state.courseLedger);

  if (!can("course.view")) return <Forbidden />;

  const patientCourse = patientCourses.find((course) => course.id === id);
  if (!patientCourse) notFound();

  const treatmentEntries = courseLedger
    .filter((entry) => entry.patientCourseId === id && entry.type === "TREATMENT")
    .sort((left, right) => left.date.localeCompare(right.date));
  const unmatchedCourseAppointments = appointments
    .filter((appointment) => appointment.usedPatientCourseId === id && appointment.status === "COMPLETED")
    .sort((left, right) => `${left.date}T${left.startTime}`.localeCompare(`${right.date}T${right.startTime}`));

  const rows: CourseSlipRow[] = treatmentEntries.map((entry) => {
      const transaction = transactions.find((item) => item.id === entry.relatedTransactionId);
      let appointment = transaction?.appointmentId
        ? appointments.find((item) => item.id === transaction.appointmentId)
        : undefined;

      if (appointment) {
        const matchedIndex = unmatchedCourseAppointments.findIndex((item) => item.id === appointment?.id);
        if (matchedIndex >= 0) unmatchedCourseAppointments.splice(matchedIndex, 1);
      } else if (unmatchedCourseAppointments.length > 0) {
        const treatmentTime = new Date(entry.date).getTime();
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;
        unmatchedCourseAppointments.forEach((item, index) => {
          const appointmentTime = new Date(`${item.date}T${item.startTime}:00+07:00`).getTime();
          const distance = Math.abs(treatmentTime - appointmentTime);
          if (distance < closestDistance) {
            closestIndex = index;
            closestDistance = distance;
          }
        });
        [appointment] = unmatchedCourseAppointments.splice(closestIndex, 1);
      }

      const patientId = transaction?.patientId ?? appointment?.patientId ?? patientCourse.patientId;
      const therapistId = transaction?.treatingStaffId ?? appointment?.physiotherapistId;
      const patient = patients.find((item) => item.id === patientId);
      const therapist = staff.find((item) => item.id === therapistId);

      return {
        id: entry.id,
        date: entry.date,
        therapistName: therapist?.name || "—",
        patientName: patient ? getPatientFullNameTh(patient) : "—",
        quantity: Math.abs(entry.quantity),
      };
    });

  return (
    <CourseSlipView
      backHref={`/courses/${id}`}
      data={{
        purchaseDate: patientCourse.purchaseDate,
        expiryDate: patientCourse.expiryDate,
        courseName: courseTemplates.find((course) => course.id === patientCourse.courseId)?.name ?? "—",
        totalSessions: patientCourse.purchased + patientCourse.bonus + patientCourse.transferIn,
        usedSessions: patientCourse.used,
        remainingSessions: remainingSessions(patientCourse),
        branch: branches.find((branch) => branch.id === patientCourse.branchId),
        rows,
      }}
    />
  );
}
