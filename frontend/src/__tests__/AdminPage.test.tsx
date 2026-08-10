import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../contexts/ToastContext';
import AdminPage from '../pages/AdminPage';
import * as examsApi from '../api/exams';
import * as categoriesApi from '../api/categories';
import * as questionsApi from '../api/questions';
import * as termsApi from '../api/terms';
import type { Exam, Category, Question, Term } from '../types';

vi.mock('../api/exams');
vi.mock('../api/categories');
vi.mock('../api/questions');
vi.mock('../api/terms');

function renderPage(initialPath = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ToastProvider>
        <AdminPage />
      </ToastProvider>
    </MemoryRouter>
  );
}

const sampleExam: Exam = {
  id: 71,
  name: 'AWS Cloud Practitioner',
  description: 'AWS試験',
  createdAt: '2026-01-01',
  totalSessions: 1,
  overallCorrectRate: 0.5,
};

const sampleCategories: Category[] = [
  { id: 21, examId: 71, name: 'ストレージ', sortOrder: 1, questionCount: 10, correctRate: 0.6 },
  { id: 22, examId: 71, name: 'データベース', sortOrder: 2, questionCount: 10, correctRate: 0.3 },
];

const sampleQuestions: Question[] = [
  {
    id: 1,
    categoryId: 21,
    text: 'S3とは何ですか？',
    explanation: 'オブジェクトストレージです',
    choices: [
      { id: 1, questionId: 1, text: 'オブジェクトストレージ', isCorrect: true, sortOrder: 1 },
      { id: 2, questionId: 1, text: 'ブロックストレージ', isCorrect: false, sortOrder: 2 },
      { id: 3, questionId: 1, text: 'ファイルストレージ', isCorrect: false, sortOrder: 3 },
      { id: 4, questionId: 1, text: 'DBストレージ', isCorrect: false, sortOrder: 4 },
    ],
  },
];

const sampleTerms: Term[] = [
  { id: 1, categoryId: 21, categoryName: 'ストレージ', name: 'S3', description: 'Simple Storage Service' },
];

beforeEach(() => {
  vi.mocked(examsApi.fetchExams).mockResolvedValue([sampleExam]);
  vi.mocked(examsApi.createExam).mockResolvedValue(sampleExam);
  vi.mocked(examsApi.updateExam).mockResolvedValue(sampleExam);
  vi.mocked(examsApi.deleteExam).mockResolvedValue(undefined);
  vi.mocked(categoriesApi.fetchCategories).mockResolvedValue(sampleCategories);
  vi.mocked(categoriesApi.createCategory).mockResolvedValue(sampleCategories[0]);
  vi.mocked(categoriesApi.updateCategory).mockResolvedValue(sampleCategories[0]);
  vi.mocked(categoriesApi.deleteCategory).mockResolvedValue(undefined);
  vi.mocked(questionsApi.fetchQuestions).mockResolvedValue(sampleQuestions);
  vi.mocked(questionsApi.createQuestion).mockResolvedValue(sampleQuestions[0]);
  vi.mocked(questionsApi.updateQuestion).mockResolvedValue(sampleQuestions[0]);
  vi.mocked(questionsApi.deleteQuestion).mockResolvedValue(undefined);
  vi.mocked(termsApi.fetchTerms).mockResolvedValue(sampleTerms);
  vi.mocked(termsApi.createTerm).mockResolvedValue(sampleTerms[0]);
  vi.mocked(termsApi.updateTerm).mockResolvedValue(sampleTerms[0]);
  vi.mocked(termsApi.deleteTerm).mockResolvedValue(undefined);
});

describe('AdminPage', () => {
  it('ローディング中は管理画面ヘッダーが表示される', () => {
    renderPage();
    expect(screen.getByText('管理画面')).toBeInTheDocument();
  });

  it('試験タブに試験一覧が表示される', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('AWS Cloud Practitioner').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('試験一覧')).toBeInTheDocument();
  });

  it('試験セレクタが表示される', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('対象試験:')).toBeInTheDocument();
    });
  });

  it('4つのタブが表示される', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '試験' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'カテゴリ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '問題' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '用語' })).toBeInTheDocument();
  });

  it('カテゴリタブにカテゴリ一覧が表示される', async () => {
    const { getByRole } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('試験一覧')).toBeInTheDocument();
    });
    // カテゴリタブをクリック
    getByRole('button', { name: 'カテゴリ' }).click();
    await waitFor(() => {
      expect(screen.getByText('ストレージ')).toBeInTheDocument();
    });
    expect(screen.getByText('データベース')).toBeInTheDocument();
  });

  it('用語タブに用語一覧が表示される', async () => {
    const { getByRole } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('試験一覧')).toBeInTheDocument();
    });
    // 用語タブをクリック
    getByRole('button', { name: '用語' }).click();
    await waitFor(() => {
      expect(screen.getByText('S3')).toBeInTheDocument();
    });
    expect(screen.getByText('Simple Storage Service')).toBeInTheDocument();
  });
});
