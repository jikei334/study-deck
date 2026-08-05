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
