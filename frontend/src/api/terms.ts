import apiClient from './client';
import type { Term } from '../types';

export async function fetchTerms(examId: number, q?: string, categoryId?: number): Promise<Term[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (categoryId != null) params.set('categoryId', String(categoryId));
  const query = params.toString();
  const res = await apiClient.get<Term[]>(`/api/exams/${examId}/terms${query ? `?${query}` : ''}`);
  return res.data;
}

export async function createTerm(
  categoryId: number,
  name: string,
  description: string,
): Promise<Term> {
  const res = await apiClient.post<Term>('/api/terms', { categoryId, name, description });
  return res.data;
}

export async function updateTerm(
  termId: number,
  name: string,
  description: string,
): Promise<Term> {
  const res = await apiClient.put<Term>(`/api/terms/${termId}`, { name, description });
  return res.data;
}

export async function deleteTerm(termId: number): Promise<void> {
  await apiClient.delete(`/api/terms/${termId}`);
}
