import type { Branch } from "@/types";

export const branches: Branch[] = [
  {
    id: "br-bkk",
    code: "BKK",
    name: "สาขาสุขุมวิท (Sukhumvit)",
    phone: "02-105-4421",
    address: "123 ถนนสุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110",
    status: "ACTIVE",
  },
  {
    id: "br-sal",
    code: "SAL",
    name: "สาขาศาลายา (Salaya)",
    phone: "02-441-0987",
    address: "99 ถนนศาลายา-นครชัยศรี อ.พุทธมณฑล จ.นครปฐม 73170",
    status: "ACTIVE",
  },
  {
    id: "br-cnx",
    code: "CNX",
    name: "สาขาเชียงใหม่ (Chiang Mai)",
    phone: "053-224-556",
    address: "45 ถนนนิมมานเหมินท์ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200",
    status: "ACTIVE",
  },
];

export function getBranchById(id: string): Branch | undefined {
  return branches.find((b) => b.id === id);
}
