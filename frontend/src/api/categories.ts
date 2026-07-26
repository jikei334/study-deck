import apiClient from './client';
import type { Category } from '../types';

export async function fetchCategories(examId: number): Promise<Category[]> {
  const res = await apiClient.get<Category[]>(`/api/exams/${examId}/categories`);
  return res.data;
}
