import type { ResourceRoom } from "@/types";

export const resources: ResourceRoom[] = [
  { id: "res-bkk-1", name: "Treatment Room 1", type: "Treatment Room", branchId: "br-bkk", status: "ACTIVE" },
  { id: "res-bkk-2", name: "Treatment Room 2", type: "Treatment Room", branchId: "br-bkk", status: "ACTIVE" },
  { id: "res-bkk-3", name: "Exercise Area", type: "Open Area", branchId: "br-bkk", status: "ACTIVE" },
  { id: "res-bkk-4", name: "Running Lab", type: "Specialty Room", branchId: "br-bkk", status: "ACTIVE" },
  { id: "res-sal-1", name: "Treatment Room 1", type: "Treatment Room", branchId: "br-sal", status: "ACTIVE" },
  { id: "res-sal-2", name: "Treatment Room 2", type: "Treatment Room", branchId: "br-sal", status: "ACTIVE" },
  { id: "res-sal-3", name: "Exercise Area", type: "Open Area", branchId: "br-sal", status: "ACTIVE" },
  { id: "res-cnx-1", name: "Treatment Room 1", type: "Treatment Room", branchId: "br-cnx", status: "ACTIVE" },
  { id: "res-cnx-2", name: "Treatment Room 2", type: "Treatment Room", branchId: "br-cnx", status: "INACTIVE" },
  { id: "res-cnx-3", name: "Exercise Area", type: "Open Area", branchId: "br-cnx", status: "ACTIVE" },
];

export function getResourceById(id: string): ResourceRoom | undefined {
  return resources.find((r) => r.id === id);
}

export function getResourcesByBranch(branchId: string): ResourceRoom[] {
  return resources.filter((r) => r.branchId === branchId && r.status === "ACTIVE");
}
