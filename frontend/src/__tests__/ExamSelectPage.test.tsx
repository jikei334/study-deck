import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../contexts/ToastContext';
import ExamSelectPage from '../pages/ExamSelectPage';
import * as examsApi from '../api/exams';
import type { Exam } from '../types';

vi.mock('../api/exams');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ExamSelectPage />
      </ToastProvider>
    </MemoryRouter>
  );
}

const sampleExams: Exam[] = [
  {
    id: 1,
    name: 'AWS Cloud Practitioner',
    description: 'AWSの基礎試験',
    createdAt: '2026-07-01T00:00:00Z',
    totalSessions: 5,
    overallCorrectRate: 0.72,
  },
  {
    id: 2,
    name: 'GCP Associate',
    description: null,
    createdAt: '2026-07-02T00:00:00Z',
    totalSessions: 0,
    overallCorrectRate: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ExamSelectPage', () => {
  it('ローディング中はスピナーが表示される', () => {
    vi.mocked(examsApi.fetchExams).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('試験一覧が表示される', async () => {
    vi.mocked(examsApi.fetchExams).mockResolvedValue(sampleExams);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('AWS Cloud Practitioner')).toBeInTheDocument();
      expect(screen.getByText('GCP Associate')).toBeInTheDocument();
    });
  });

  it('正答率が%表示される', async () => {
    vi.mocked(examsApi.fetchExams).mockResolvedValue(sampleExams);
    renderPage();
    await waitFor(() => expect(screen.getByText('72%')).toBeInTheDocument());
  });

  it('未受験の試験は正答率「未受験」と表示される', async () => {
    vi.mocked(examsApi.fetchExams).mockResolvedValue(sampleExams);
    renderPage();
    await waitFor(() => expect(screen.getByText('未受験')).toBeInTheDocument());
  });

  it('試験が0件のとき空状態メッセージを表示する', async () => {
    vi.mocked(examsApi.fetchExams).mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('試験がまだ登録されていません')).toBeInTheDocument()
    );
  });

  it('試験カードをクリックすると/exams/:idへ遷移する', async () => {
    vi.mocked(examsApi.fetchExams).mockResolvedValue(sampleExams);
    renderPage();
    await waitFor(() => screen.getByText('AWS Cloud Practitioner'));
    await userEvent.click(screen.getByText('AWS Cloud Practitioner'));
    expect(mockNavigate).toHaveBeenCalledWith('/exams/1');
  });

  it('「+ 試験を追加」クリックで/adminへ遷移する', async () => {
    vi.mocked(examsApi.fetchExams).mockResolvedValue(sampleExams);
    renderPage();
    await waitFor(() => screen.getByText('+ 試験を追加'));
    await userEvent.click(screen.getByText('+ 試験を追加'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin');
  });

  it('API失敗時はエラートーストが表示される', async () => {
    vi.mocked(examsApi.fetchExams).mockRejectedValue(new Error('通信エラー'));
    renderPage();
    await waitFor(() => expect(screen.getByText('通信エラー')).toBeInTheDocument());
  });
});
