import type { AppUser } from "@/types";

/**
 * One login per staff member. Two access levels: ADMIN and PHYSIOTHERAPIST.
 * `staffId` links the account to its Staff record — the Staff & Access screen
 * presents the two as a single person.
 */
export const users: AppUser[] = [
  {
    id: "usr-admin",
    username: "admin",
    password: "demo",
    role: "ADMIN",
    staffId: "stf-mgr1",
    displayName: "ธนกร บริหารงาม",
    branchIds: ["br-bkk", "br-sal", "br-cnx"],
    status: "ACTIVE",
    lastLogin: "2026-08-12T07:50:00",
  },
  {
    id: "usr-admin2",
    username: "admin2",
    password: "demo",
    role: "ADMIN",
    staffId: "stf-mgr2",
    displayName: "นภัสสร ต้อนรับดี",
    branchIds: ["br-bkk", "br-sal"],
    status: "ACTIVE",
    lastLogin: "2026-08-12T08:45:00",
  },
  {
    id: "usr-physio",
    username: "physio",
    password: "demo",
    role: "PHYSIOTHERAPIST",
    staffId: "stf-phy1",
    displayName: "สุพจน์ กายภาพเก่ง",
    branchIds: ["br-bkk"],
    status: "ACTIVE",
    lastLogin: "2026-08-12T08:15:00",
  },
  {
    id: "usr-physio2",
    username: "physio2",
    password: "demo",
    role: "PHYSIOTHERAPIST",
    staffId: "stf-phy3",
    displayName: "อรรถพล ฟื้นฟูชีพ",
    branchIds: ["br-sal"],
    status: "ACTIVE",
    lastLogin: "2026-08-11T17:20:00",
  },
  {
    id: "usr-assistant",
    username: "assistant",
    password: "demo",
    role: "PHYSIOTHERAPIST",
    staffId: "stf-asst1",
    displayName: "ปิยะดา เอื้อเฟื้อ",
    branchIds: ["br-cnx"],
    status: "ACTIVE",
    lastLogin: "2026-08-11T18:00:00",
  },
];

export function getUserByUsername(username: string): AppUser | undefined {
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export function getUserById(id: string): AppUser | undefined {
  return users.find((u) => u.id === id);
}
