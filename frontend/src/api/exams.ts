import apiClient from './client';
import type { Exam } from '../types';

export async function fetchExams(): Promise<Exam[]> {
  const res = await apiClient.get<Exam[]>('/api/exams');
  return res.data;
}

export async function fetchExam(examId: number): Promise<Exam> {
  const res = await apiClient.get<Exam>(`/api/exams/${examId}`);
  return res.data;
}

export async function createExam(name: string, description?: string): Promise<Exam> {
  const res = await apiClient.post<Exam>('/api/exams', { name, description });
  return res.data;
}

export async function updateExam(examId: number, name: string, description?: string): Promise<Exam> {
  const res = await apiClient.put<Exam>(`/api/exams/${examId}`, { name, description });
  return res.data;
}

export async function deleteExam(examId: number): Promise<void> {
  await apiClient.delete(`/api/exams/${examId}`);
}
