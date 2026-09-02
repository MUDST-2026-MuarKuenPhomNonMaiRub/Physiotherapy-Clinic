import type { Branch } from "@/types";

export const branches: Branch[] = [
  {
    id: "br-bkk",
    code: "R9",
    name: "สาขา พระราม 9 (ใกล้ The nine)",
    phone: "",
    address: "พระราม 9 กรุงเทพฯ",
    status: "ACTIVE",
  },
  {
    id: "br-sal",
    code: "BR",
    name: "สาขา แบริ่ง (ซ.แบริ่ง 4)",
    phone: "",
    address: "ซอยแบริ่ง 4 สมุทรปราการ",
    status: "ACTIVE",
  },
];

export function getBranchById(id: string): Branch | undefined {
  return branches.find((b) => b.id === id);
}
