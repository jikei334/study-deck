import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchSessionResult } from '../api/quiz';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CategoryBarChart from '../components/charts/CategoryBarChart';
import type { SessionResult } from '../types';

export default function QuizResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [result, setResult] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);

  const id = Number(sessionId);

  useEffect(() => {
    fetchSessionResult(id)
      .then(setResult)
      .catch((e: Error) => { showToast(e.message); navigate('/'); })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <LoadingSpinner />
      </div>
    );
  }

  if (!result) return null;

  const pct = Math.round(result.correctRate * 100);
  const scoreColor = pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-yellow-500' : 'text-red-500';

  // CategoryBarChart の型に合わせてマッピング
  const chartData = result.categoryStats.map((s) => ({
    categoryId: s.categoryId,
    categoryName: s.categoryName,
    totalAnswered: s.total,
    correctCount: s.correct,
    correctRate: s.correctRate,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* スコア */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500 mb-2">結果</p>
          <p className={`text-6xl font-bold ${scoreColor}`}>{pct}%</p>
          <p className="text-gray-600 mt-2">
            {result.correctCount} / {result.totalCount} 問正解
          </p>
          <div className="flex justify-center gap-4 mt-6">
            <Link
              to={`/exams/${result.examId}`}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
            >
              ダッシュボードへ
            </Link>
            <Link
              to={`/exams/${result.examId}/quiz`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              もう一度クイズ
            </Link>
          </div>
        </div>

        {/* カテゴリ別棒グラフ */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">カテゴリ別正答率</h3>
            <CategoryBarChart data={chartData} />
          </div>
        )}

        {/* 正誤一覧 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">回答一覧</h3>
          <div className="space-y-4">
            {result.answers.map((a, i) => (
              <div
                key={a.questionId}
                className={`p-4 rounded-lg border ${a.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-sm font-bold shrink-0 ${a.isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                    {a.isCorrect ? '✓' : '✗'} Q{i + 1}.
                  </span>
                  <p className="text-sm text-gray-800">{a.questionText}</p>
                </div>
                <div className="mt-2 ml-6 space-y-1 text-sm">
                  <p className="text-gray-600">
                    <span className="font-medium">あなたの回答: </span>
                    <span className={a.isCorrect ? 'text-green-700' : 'text-red-600'}>{a.selectedChoiceText}</span>
                  </p>
                  {!a.isCorrect && (
                    <p className="text-gray-600">
                      <span className="font-medium">正解: </span>
                      <span className="text-green-700">{a.correctChoiceText}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <h1 className="text-2xl font-bold text-blue-600 tracking-tight">study-deck</h1>
    </header>
  );
}
