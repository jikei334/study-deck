export interface Exam {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  totalSessions: number;
  overallCorrectRate: number | null;
}

export interface Category {
  id: number;
  examId: number;
  name: string;
  sortOrder: number;
  questionCount: number;
  correctRate: number | null;
}

export interface Choice {
  id: number;
  questionId: number;
  text: string;
  isCorrect?: boolean;
  explanation?: string;
  sortOrder: number;
}

export interface Question {
  id: number;
  categoryId: number;
  text: string;
  explanation: string | null;
  choices: Choice[];
}

export interface Term {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  description: string;
}

export type QuizMode = 'category' | 'random' | 'weak';

export interface QuizSessionQuestion {
  id: number;
  text: string;
  choices: Pick<Choice, 'id' | 'text' | 'sortOrder'>[];
}

export interface QuizSession {
  id: number;
  examId: number;
  mode: QuizMode;
  questions: QuizSessionQuestion[];
}

export interface AnswerResult {
  isCorrect: boolean;
  correctChoiceId: number;
  choices: (Pick<Choice, 'id' | 'text' | 'isCorrect' | 'explanation'>)[];
  questionExplanation: string | null;
}

export interface SessionResultAnswer {
  questionId: number;
  questionText: string;
  selectedChoiceId: number;
  selectedChoiceText: string;
  correctChoiceId: number;
  correctChoiceText: string;
  isCorrect: boolean;
}

export interface SessionResult {
  id: number;
  examId: number;
  mode: QuizMode;
  startedAt: string;
  completedAt: string;
  totalCount: number;
  correctCount: number;
  correctRate: number;
  categoryStats: {
    categoryId: number;
    categoryName: string;
    total: number;
    correct: number;
    correctRate: number;
  }[];
  answers: SessionResultAnswer[];
}

export interface CategoryStat {
  categoryId: number;
  categoryName: string;
  totalAnswered: number;
  correctCount: number;
  correctRate: number;
}

export interface RecentSession {
  id: number;
  mode: QuizMode;
  correctCount: number;
  totalCount: number;
  correctRate: number;
  completedAt: string;
}

export interface ExamStats {
  categoryStats: CategoryStat[];
  recentSessions: RecentSession[];
}
