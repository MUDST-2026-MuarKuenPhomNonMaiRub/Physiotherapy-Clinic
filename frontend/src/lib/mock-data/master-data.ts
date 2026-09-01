import type { MasterDataItem } from "@/types";

export const masterData: MasterDataItem[] = [
  { id: "cg-walkin", category: "CUSTOMER_GROUP", value: "Walk-in", status: "ACTIVE" },
  { id: "cg-member", category: "CUSTOMER_GROUP", value: "Member", status: "ACTIVE" },
  { id: "cg-vip", category: "CUSTOMER_GROUP", value: "VIP", status: "ACTIVE" },
  { id: "cg-corporate", category: "CUSTOMER_GROUP", value: "Corporate", status: "ACTIVE" },
  { id: "cg-staff", category: "CUSTOMER_GROUP", value: "Staff / Family", status: "INACTIVE" },

  { id: "rc-facebook", category: "REFERRAL_CHANNEL", value: "Facebook", status: "ACTIVE" },
  { id: "rc-instagram", category: "REFERRAL_CHANNEL", value: "Instagram", status: "ACTIVE" },
  { id: "rc-google", category: "REFERRAL_CHANNEL", value: "Google Search", status: "ACTIVE" },
  { id: "rc-friend", category: "REFERRAL_CHANNEL", value: "Friend Referral", status: "ACTIVE" },
  { id: "rc-doctor", category: "REFERRAL_CHANNEL", value: "Doctor Referral", status: "ACTIVE" },
  { id: "rc-walkby", category: "REFERRAL_CHANNEL", value: "Walk-by", status: "ACTIVE" },
  { id: "rc-line", category: "REFERRAL_CHANNEL", value: "LINE Official", status: "INACTIVE" },

  { id: "ins-none", category: "INSURANCE_COMPANY", value: "None / Self-pay", status: "ACTIVE" },
  { id: "ins-aia", category: "INSURANCE_COMPANY", value: "AIA", status: "ACTIVE" },
  { id: "ins-bupa", category: "INSURANCE_COMPANY", value: "Bupa Thailand", status: "ACTIVE" },
  { id: "ins-allianz", category: "INSURANCE_COMPANY", value: "Allianz Ayudhya", status: "ACTIVE" },
  { id: "ins-muang", category: "INSURANCE_COMPANY", value: "Muang Thai Life", status: "INACTIVE" },
];

export function getMasterDataByCategory(
  category: MasterDataItem["category"]
): MasterDataItem[] {
  return masterData.filter((m) => m.category === category);
}
