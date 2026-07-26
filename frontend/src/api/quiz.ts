import apiClient from './client';
import type { QuizSession, AnswerResult, SessionResult, QuizMode } from '../types';

export async function createQuizSession(
  examId: number,
  mode: QuizMode,
  categoryId?: number
): Promise<QuizSession> {
  const res = await apiClient.post<QuizSession>('/api/quiz/sessions', {
    examId,
    mode,
    ...(categoryId != null ? { categoryId } : {}),
  });
  return res.data;
}

export async function fetchQuizSession(sessionId: number): Promise<QuizSession> {
  const res = await apiClient.get<QuizSession>(`/api/quiz/sessions/${sessionId}`);
  return res.data;
}

export async function submitAnswer(
  sessionId: number,
  questionId: number,
  selectedChoiceId: number
): Promise<AnswerResult> {
  const res = await apiClient.post<AnswerResult>(`/api/quiz/sessions/${sessionId}/answers`, {
    questionId,
    selectedChoiceId,
  });
  return res.data;
}

export async function completeQuizSession(sessionId: number): Promise<void> {
  await apiClient.patch(`/api/quiz/sessions/${sessionId}/complete`);
}

export async function fetchSessionResult(sessionId: number): Promise<SessionResult> {
  const res = await apiClient.get<SessionResult>(`/api/quiz/sessions/${sessionId}/result`);
  return res.data;
}
