export type Branch = { id: number; code: string; name: string; phone: string; address: string; active: boolean };
export type BranchInput = Omit<Branch, 'id'>;
