import apiClient from './client';
import type { Category } from '../types';

export async function fetchCategories(examId: number): Promise<Category[]> {
  const res = await apiClient.get<Category[]>(`/api/exams/${examId}/categories`);
  return res.data;
}

export async function createCategory(examId: number, name: string, sortOrder: number): Promise<Category> {
  const res = await apiClient.post<Category>(`/api/exams/${examId}/categories`, { name, sortOrder });
  return res.data;
}

export async function updateCategory(categoryId: number, name: string, sortOrder: number): Promise<Category> {
  const res = await apiClient.put<Category>(`/api/categories/${categoryId}`, { name, sortOrder });
  return res.data;
}

export async function deleteCategory(categoryId: number): Promise<void> {
  await apiClient.delete(`/api/categories/${categoryId}`);
}
