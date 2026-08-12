import apiClient from './client';
import type { ExamStats } from '../types';

export async function fetchExamStats(examId: number): Promise<ExamStats> {
  const res = await apiClient.get<ExamStats>(`/api/exams/${examId}/stats`);
  return res.data;
}
