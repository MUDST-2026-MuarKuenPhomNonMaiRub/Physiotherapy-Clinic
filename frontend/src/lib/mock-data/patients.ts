import type { Patient } from "@/types";

// HN format: YY + BB (branch no.) + MM + NNNN (sequence)
export function generateHN(
  branchSeq: number,
  year: number,
  month: number,
  seq: number
): string {
  const yy = String(year % 100).padStart(2, "0");
  const bb = String(branchSeq).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const nnnn = String(seq).padStart(4, "0");
  return `${yy}${bb}${mm}${nnnn}`;
}

const branchSeqMap: Record<string, number> = {
  "br-bkk": 1,
  "br-sal": 2,
  "br-cnx": 3,
};

const thFirst = [
  "สมชาย", "สมศรี", "สมหญิง", "วิชัย", "อรพรรณ", "ธีรพงษ์", "กัลยา", "ประเสริฐ",
  "นภาพร", "สุรชัย", "จินตนา", "ณัฐพล", "รัตนา", "ชูเกียรติ", "พิมพ์ใจ", "ศักดิ์ชัย",
  "อรุณี", "วรวุฒิ", "มณีรัตน์", "เอกชัย", "สุนิสา", "กิตติศักดิ์", "ปิยะนุช", "ธวัชชัย",
  "อัญชลี", "พีรพัฒน์", "รุ่งนภา", "ชัยวัฒน์", "วราภรณ์", "สิทธิชัย",
];
const thLast = [
  "ใจดี", "ใจดี", "รักสุขภาพ", "เจริญสุข", "พูลทรัพย์", "แข็งแรงมาก", "สายทอง", "มั่นคง",
  "ศรีสวัสดิ์", "วงศ์ไพศาล", "บุญมี", "ทองสุข", "รุ่งเรือง", "ประเสริฐกุล", "ธรรมชาติ",
  "สุขสวัสดิ์", "โพธิ์ทอง", "แสงจันทร์", "อยู่ดี", "เกษมสุข", "ทวีสิน", "ก้าวหน้า",
  "จันทร์เพ็ญ", "สว่างวงศ์", "อารีย์", "เมืองแก้ว", "ไพบูลย์", "สุขเจริญ", "ยิ้มแย้ม", "มีชัย",
];
const enFirst = [
  "Somchai", "Somsri", "Somying", "Wichai", "Oraphan", "Theerapong", "Kanlaya", "Prasert",
  "Napaporn", "Surachai", "Jintana", "Nattapon", "Rattana", "Chukiat", "Pimjai", "Sakchai",
  "Arunee", "Worawut", "Maneerat", "Ekkachai", "Sunisa", "Kittisak", "Piyanuch", "Thawatchai",
  "Anchalee", "Peerapat", "Rungnapha", "Chaiwat", "Waraporn", "Sitthichai",
];
const enLast = [
  "Jaidee", "Jaidee", "Raksukkhaphap", "Charoensuk", "Poonsub", "Khangraengmak", "Saithong",
  "Mankhong", "Srisawat", "Wongphaisan", "Boonmee", "Thongsuk", "Rungruang", "Prasertkul",
  "Thammachat", "Suksawat", "Pothong", "Saengchan", "Yoodee", "Kasemsuk", "Thaweesin",
  "Kaona", "Chanpen", "Sawangwong", "Aree", "Muangkaew", "Paiboon", "Sukcharoen", "Yimyaem",
  "Meechai",
];

const customerGroups = ["Walk-in", "Member", "VIP", "Corporate"];
const referralChannels = [
  "Facebook", "Instagram", "Google Search", "Friend Referral", "Doctor Referral", "Walk-by",
];
const insuranceCompanies = ["None / Self-pay", "AIA", "Bupa Thailand", "Allianz Ayudhya"];
const bloodGroups = ["A", "B", "AB", "O"];

function dobFromAge(age: number, seed: number): string {
  const year = 2026 - age;
  const month = (seed % 12) + 1;
  const day = (seed % 27) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface PatientSeed {
  id: string;
  hn: string;
  branchId: string;
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn: string;
  lastNameEn: string;
  gender: Patient["gender"];
  age: number;
  phone: string;
  customerGroup: string;
  referralChannel: string;
  insuranceCompany: string;
  createdAt: string;
  regMonth: number;
  seq: number;
}

const named: PatientSeed[] = [
  {
    id: "p-001", hn: "", branchId: "br-bkk", firstNameTh: "สมชาย", lastNameTh: "ใจดี",
    firstNameEn: "Somchai", lastNameEn: "Jaidee", gender: "MALE", age: 42,
    phone: "089-555-0123", customerGroup: "Member", referralChannel: "Friend Referral",
    insuranceCompany: "None / Self-pay", createdAt: "2026-02-10", regMonth: 2, seq: 1,
  },
  {
    id: "p-002", hn: "", branchId: "br-bkk", firstNameTh: "สมศรี", lastNameTh: "ใจดี",
    firstNameEn: "Somsri", lastNameEn: "Jaidee", gender: "FEMALE", age: 39,
    phone: "089-555-0124", customerGroup: "Member", referralChannel: "Friend Referral",
    insuranceCompany: "None / Self-pay", createdAt: "2026-02-10", regMonth: 2, seq: 2,
  },
  {
    id: "p-003", hn: "", branchId: "br-sal", firstNameTh: "สมหญิง", lastNameTh: "รักสุขภาพ",
    firstNameEn: "Somying", lastNameEn: "Raksukkhaphap", gender: "FEMALE", age: 34,
    phone: "086-777-2201", customerGroup: "VIP", referralChannel: "Instagram",
    insuranceCompany: "Bupa Thailand", createdAt: "2026-01-15", regMonth: 1, seq: 1,
  },
];

const generated: PatientSeed[] = Array.from({ length: 27 }).map((_, i) => {
  const idx = i + 3; // continue name bank offset
  const branchId = ["br-bkk", "br-sal", "br-cnx"][i % 3];
  const regMonth = (i % 7) + 1;
  const seq = Math.floor(i / 3) + 3;
  return {
    id: `p-${String(idx + 1).padStart(3, "0")}`,
    hn: "",
    branchId,
    firstNameTh: thFirst[idx % thFirst.length],
    lastNameTh: thLast[(idx + 5) % thLast.length],
    firstNameEn: enFirst[idx % enFirst.length],
    lastNameEn: enLast[(idx + 5) % enLast.length],
    gender: i % 2 === 0 ? "MALE" : "FEMALE",
    age: 20 + ((idx * 7) % 55),
    phone: `08${(idx % 10)}-${String(100 + idx * 17).padStart(3, "0")}-${String(
      1000 + idx * 31
    ).padStart(4, "0")}`,
    customerGroup: customerGroups[idx % customerGroups.length],
    referralChannel: referralChannels[idx % referralChannels.length],
    insuranceCompany: insuranceCompanies[idx % insuranceCompanies.length],
    createdAt: `2026-${String(regMonth).padStart(2, "0")}-${String(5 + (idx % 20)).padStart(2, "0")}`,
    regMonth,
    seq,
  };
});

const allSeeds = [...named, ...generated];

export const patients: Patient[] = allSeeds.map((s) => {
  const hn = generateHN(branchSeqMap[s.branchId], 2026, s.regMonth, s.seq);
  return {
    id: s.id,
    hn,
    customerType: "THAI",
    titleTh: s.gender === "MALE" ? "นาย" : "นาง",
    firstNameTh: s.firstNameTh,
    lastNameTh: s.lastNameTh,
    firstNameEn: s.firstNameEn,
    lastNameEn: s.lastNameEn,
    nickname: s.firstNameTh.slice(0, 2),
    gender: s.gender,
    dob: dobFromAge(s.age, s.seq + s.regMonth),
    bloodGroup: bloodGroups[s.seq % bloodGroups.length],
    nationality: "Thai",
    nationalId: `1${String(1000000000 + Number(s.id.replace(/\D/g, "")) * 37).slice(0, 12)}`,
    phone: s.phone,
    address: `${10 + s.seq} ถนนพระราม 9 แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ 10240`,
    customerGroup: s.customerGroup,
    referralChannel: s.referralChannel,
    insuranceCompany: s.insuranceCompany,
    registrationBranchId: s.branchId,
    createdAt: s.createdAt,
  };
});

export function getPatientById(id: string): Patient | undefined {
  return patients.find((p) => p.id === id);
}

export function getPatientFullNameTh(p: Patient): string {
  return `${p.titleTh}${p.firstNameTh} ${p.lastNameTh}`;
}

export function getPatientFullNameEn(p: Patient): string {
  return `${p.firstNameEn} ${p.lastNameEn}`;
}

export function searchPatients(query: string, list: Patient[] = patients): Patient[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((p) =>
    [
      p.hn,
      p.firstNameTh,
      p.lastNameTh,
      p.firstNameEn,
      p.lastNameEn,
      p.phone,
      p.nationalId,
      p.passport,
    ]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(q))
  );
}
