import type { CourseTemplate, Service } from "@/types";

export const services: Service[] = [
  {
    id: "svc-assess",
    name: "Physical Assessment",
    type: "ASSESSMENT",
    price: 500,
    duration: 30,
    status: "ACTIVE",
  },
  {
    id: "svc-office",
    name: "Office Syndrome Treatment",
    type: "SINGLE_VISIT",
    price: 900,
    duration: 45,
    status: "ACTIVE",
  },
  {
    id: "svc-sports",
    name: "Sports Injury Rehabilitation",
    type: "SINGLE_VISIT",
    price: 1200,
    duration: 60,
    status: "ACTIVE",
  },
  {
    id: "svc-back",
    name: "Lower Back Pain Therapy",
    type: "SINGLE_VISIT",
    price: 1000,
    duration: 45,
    status: "ACTIVE",
  },
  {
    id: "svc-postop",
    name: "Post-Operative Rehabilitation",
    type: "SINGLE_VISIT",
    price: 1400,
    duration: 60,
    status: "ACTIVE",
  },
  {
    id: "svc-shockwave",
    name: "Shockwave Therapy",
    type: "SINGLE_VISIT",
    price: 1600,
    duration: 30,
    status: "ACTIVE",
  },
  {
    id: "svc-dryneedle",
    name: "Dry Needling",
    type: "SINGLE_VISIT",
    price: 800,
    duration: 30,
    status: "ACTIVE",
  },
  {
    id: "svc-sports-massage",
    name: "Therapeutic Sports Massage",
    type: "SINGLE_VISIT",
    price: 700,
    duration: 45,
    status: "INACTIVE",
  },
];

export const courseTemplates: CourseTemplate[] = [
  {
    id: "crs-office10",
    name: "Office Syndrome Package",
    description: "แพ็กเกจกายภาพบำบัดสำหรับกลุ่มอาการออฟฟิศซินโดรม",
    price: 8900,
    sessions: 10,
    bonusSessions: 2,
    expiryDays: 180,
    status: "ACTIVE",
  },
  {
    id: "crs-sports20",
    name: "Sports Recovery Package",
    description: "แพ็กเกจฟื้นฟูนักกีฬาและอาการบาดเจ็บจากการเล่นกีฬา",
    price: 16500,
    sessions: 20,
    bonusSessions: 4,
    expiryDays: 240,
    status: "ACTIVE",
  },
  {
    id: "crs-back5",
    name: "Back Pain Relief Package",
    description: "แพ็กเกจรักษาอาการปวดหลังเรื้อรัง",
    price: 4500,
    sessions: 5,
    bonusSessions: 1,
    expiryDays: 120,
    status: "ACTIVE",
  },
  {
    id: "crs-postop15",
    name: "Post-Op Recovery Package",
    description: "แพ็กเกจฟื้นฟูหลังการผ่าตัด",
    price: 19500,
    sessions: 15,
    bonusSessions: 3,
    expiryDays: 270,
    status: "ACTIVE",
  },
  {
    id: "crs-wellness8",
    name: "Wellness Maintenance Package",
    description: "แพ็กเกจดูแลสุขภาพร่างกายเชิงป้องกัน",
    price: 7200,
    sessions: 8,
    bonusSessions: 1,
    expiryDays: 180,
    status: "ACTIVE",
  },
  {
    id: "crs-senior12",
    name: "Senior Mobility Package",
    description: "แพ็กเกจฟื้นฟูการเคลื่อนไหวสำหรับผู้สูงอายุ",
    price: 10800,
    sessions: 12,
    bonusSessions: 2,
    expiryDays: 210,
    status: "INACTIVE",
  },
];

export function getServiceById(id: string): Service | undefined {
  return services.find((s) => s.id === id);
}

export function getCourseTemplateById(id: string): CourseTemplate | undefined {
  return courseTemplates.find((c) => c.id === id);
}
