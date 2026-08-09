import apiClient from './client';
import type { Question } from '../types';

export interface ChoiceInput {
  text: string;
  isCorrect: boolean;
  explanation: string | null;
  sortOrder: number;
}

export async function fetchQuestions(categoryId: number): Promise<Question[]> {
  const res = await apiClient.get<Question[]>(`/api/categories/${categoryId}/questions`);
  return res.data;
}

export async function createQuestion(
  categoryId: number,
  text: string,
  explanation: string | null,
  choices: ChoiceInput[],
): Promise<Question> {
  const res = await apiClient.post<Question>('/api/questions', { categoryId, text, explanation, choices });
  return res.data;
}

export async function updateQuestion(
  questionId: number,
  text: string,
  explanation: string | null,
  choices: ChoiceInput[],
): Promise<Question> {
  const res = await apiClient.put<Question>(`/api/questions/${questionId}`, { text, explanation, choices });
  return res.data;
}

export async function deleteQuestion(questionId: number): Promise<void> {
  await apiClient.delete(`/api/questions/${questionId}`);
}
