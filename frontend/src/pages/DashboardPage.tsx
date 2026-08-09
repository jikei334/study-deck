import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchExam } from '../api/exams';
import { fetchExamStats } from '../api/stats';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CategoryRadarChart from '../components/charts/CategoryRadarChart';
import CategoryBarChart from '../components/charts/CategoryBarChart';
import type { Exam, ExamStats } from '../types';

function modeLabel(mode: string): string {
  if (mode === 'category') return 'カテゴリ別';
  if (mode === 'random') return 'ランダム';
  if (mode === 'weak') return '苦手';
  return mode;
}

function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <h1 className="text-2xl font-bold text-blue-600 tracking-tight">study-deck</h1>
    </header>
  );
}

export default function DashboardPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [exam, setExam] = useState<Exam | null>(null);
  const [stats, setStats] = useState<ExamStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = Number(examId);
    Promise.all([fetchExam(id), fetchExamStats(id)])
      .then(([e, s]) => {
        setExam(e);
        setStats(s);
      })
      .catch((e: Error) => {
        showToast(e.message);
        navigate('/');
      })
      .finally(() => setLoading(false));
  }, [examId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <LoadingSpinner />
      </div>
    );
  }

  if (!exam || !stats) return null;

  const hasStats = stats.categoryStats.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* タイトル + アクションボタン */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <Link to="/" className="text-sm text-blue-600 hover:text-blue-800 mb-1 inline-block">
              ← 試験一覧
            </Link>
            <h2 className="text-2xl font-bold text-gray-900">{exam.name}</h2>
            {exam.description && (
              <p className="text-sm text-gray-500 mt-1">{exam.description}</p>
            )}
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => navigate(`/admin?examId=${exam.id}`)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
            >
              管理
            </button>
            <button
              onClick={() => navigate(`/exams/${exam.id}/terms`)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
            >
              用語を検索
            </button>
            <button
              onClick={() => navigate(`/exams/${exam.id}/quiz`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              クイズを始める
            </button>
          </div>
        </div>

        {/* チャートエリア */}
        {!hasStats ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <p className="text-lg">まだ回答データがありません</p>
            <p className="text-sm mt-2">クイズを受けると成績がここに表示されます</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">カテゴリ別正答率（レーダー）</h3>
              <CategoryRadarChart data={stats.categoryStats} />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">カテゴリ別正答率（低い順）</h3>
              <CategoryBarChart data={stats.categoryStats} />
            </div>
          </div>
        )}

        {/* セッション履歴 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">直近のセッション履歴</h3>
          {stats.recentSessions.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">セッション履歴がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="text-xs text-gray-500 uppercase border-b border-gray-200">
                  <tr>
                    <th className="pb-2 pr-6">日時</th>
                    <th className="pb-2 pr-6">モード</th>
                    <th className="pb-2 pr-6 text-right">正解</th>
                    <th className="pb-2 pr-6 text-right">問題数</th>
                    <th className="pb-2 text-right">正答率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.recentSessions.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 pr-6">{new Date(s.completedAt).toLocaleString('ja-JP')}</td>
                      <td className="py-2 pr-6">{modeLabel(s.mode)}</td>
                      <td className="py-2 pr-6 text-right">{s.correctCount}</td>
                      <td className="py-2 pr-6 text-right">{s.totalCount}</td>
                      <td className="py-2 text-right font-medium">{Math.round(s.correctRate * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
