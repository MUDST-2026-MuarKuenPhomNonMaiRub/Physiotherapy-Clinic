import type { Staff } from "@/types";

export const staff: Staff[] = [
  {
    id: "stf-mgr1",
    name: "ธนกร บริหารงาม",
    nameEn: "Thanakorn Borihangam",
    position: "Clinic Manager",
    branchIds: ["br-bkk", "br-sal"],
    phone: "081-234-5673",
    email: "thanakorn.b@labalancephysio.com",
    status: "ACTIVE",
    avatarColor: "bg-[#1A4A2E]",
  },
  {
    id: "stf-mgr2",
    name: "นภัสสร ต้อนรับดี",
    nameEn: "Napassorn Tonrapdee",
    position: "Clinic Manager",
    branchIds: ["br-bkk", "br-sal"],
    phone: "081-234-5671",
    email: "napassorn.t@labalancephysio.com",
    status: "ACTIVE",
    avatarColor: "bg-[#2D6B45]",
  },
  {
    id: "stf-asst1",
    name: "ปิยะดา เอื้อเฟื้อ",
    nameEn: "Piyada Ueafuea",
    position: "Assistant Therapist",
    branchIds: ["br-sal"],
    phone: "081-234-5672",
    email: "piyada.u@labalancephysio.com",
    status: "ACTIVE",
    avatarColor: "bg-[#586050]",
  },
  {
    id: "stf-phy1",
    name: "สุพจน์ กายภาพเก่ง",
    nameEn: "Supoj Kaiyaphapkeng",
    position: "Physiotherapist",
    branchIds: ["br-bkk"],
    phone: "081-345-6781",
    email: "supoj.k@labalancephysio.com",
    status: "ACTIVE",
    avatarColor: "bg-[#24BEE2]",
  },
  {
    id: "stf-phy2",
    name: "วรรณวิสา เคลื่อนไหวดี",
    nameEn: "Wanwisa Kluenwaidee",
    position: "Physiotherapist",
    branchIds: ["br-bkk", "br-sal"],
    phone: "081-345-6782",
    email: "wanwisa.k@labalancephysio.com",
    status: "ACTIVE",
    avatarColor: "bg-[#1A9DBF]",
  },
  {
    id: "stf-phy3",
    name: "อรรถพล ฟื้นฟูชีพ",
    nameEn: "Atthapon Fuenfuchiep",
    position: "Physiotherapist",
    branchIds: ["br-sal"],
    phone: "081-345-6783",
    email: "atthapon.f@labalancephysio.com",
    status: "ACTIVE",
    avatarColor: "bg-[#2D6B45]",
  },
  {
    id: "stf-phy4",
    name: "ชนากานต์ ยืดเหยียดดี",
    nameEn: "Chanakan Yuedyiatdee",
    position: "Physiotherapist",
    branchIds: ["br-sal"],
    phone: "081-345-6784",
    email: "chanakan.y@labalancephysio.com",
    status: "ACTIVE",
    avatarColor: "bg-[#586050]",
  },
  {
    id: "stf-phy5",
    name: "ปกรณ์ กล้ามเนื้อแกร่ง",
    nameEn: "Pakorn Klamnuakraeng",
    position: "Physiotherapist",
    branchIds: ["br-bkk"],
    phone: "081-345-6785",
    email: "pakorn.k@labalancephysio.com",
    status: "ACTIVE",
    avatarColor: "bg-[#F3AB3B]",
  },
  {
    id: "stf-phy6",
    name: "ดวงกมล ท่าดีมีสุข",
    nameEn: "Duangkamol Thadeemeesuk",
    position: "Physiotherapist",
    branchIds: ["br-sal"],
    phone: "081-345-6786",
    email: "duangkamol.t@labalancephysio.com",
    status: "INACTIVE",
    avatarColor: "bg-[#7A8470]",
  },
];

export function getStaffById(id: string): Staff | undefined {
  return staff.find((s) => s.id === id);
}

export function getPhysiotherapists(branchId?: string): Staff[] {
  return staff.filter(
    (s) =>
      s.position === "Physiotherapist" &&
      s.status === "ACTIVE" &&
      (!branchId || s.branchIds.includes(branchId))
  );
}

/**
 * Anyone on shift can sell — the clinic has no dedicated front desk — so every
 * active staff member at the branch is a valid salesperson.
 */
export function getSalesStaff(branchId?: string): Staff[] {
  return staff.filter(
    (s) => s.status === "ACTIVE" && (!branchId || s.branchIds.includes(branchId))
  );
}
