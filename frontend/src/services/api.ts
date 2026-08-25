import type { Branch, BranchInput } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export const branchApi = {
  list: () => request<Branch[]>('/branches'),
  create: (input: BranchInput) => request<Branch>('/branches', { method: 'POST', body: JSON.stringify(input) }),
  toggle: (id: number, active: boolean) => request<Branch>(`/branches/${id}/status`, { method: 'PATCH', body: JSON.stringify({ active }) }),
};
