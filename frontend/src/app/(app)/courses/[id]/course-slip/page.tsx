"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { CourseSlipView, type CourseSlipRow } from "@/components/course-slip/course-slip-view";
import { Forbidden } from "@/components/shared/forbidden";
import { useSession } from "@/lib/auth/use-session";
import { getPatientFullNameTh, remainingSessions } from "@/lib/domain";
import { useClinicStore } from "@/lib/store/clinic-store";
import { RecordGate } from "@/components/shared/record-gate";

export default function CourseSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const found = useClinicStore((s) => s.patientCourses.some((item) => item.id === id));
  return (
    <RecordGate found={found} title="Course not found" backHref="/courses" backLabel="Back to Patient Courses">
      <CourseSlipContent params={params} />
    </RecordGate>
  );
}

function CourseSlipContent({ params }: { params: Promise<{ id: string }> }) {
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
  const rows: CourseSlipRow[] = treatmentEntries.map((entry) => {
      const transaction = transactions.find((item) => item.id === entry.relatedTransactionId);
      const appointmentId = entry.relatedAppointmentId ?? transaction?.appointmentId;
      const appointment = appointmentId
        ? appointments.find((item) => item.id === appointmentId)
        : undefined;

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
