import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchExam } from '../api/exams';
import { fetchCategories } from '../api/categories';
import { createQuizSession } from '../api/quiz';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import type { Exam, Category, QuizMode } from '../types';

const MODE_LABELS: Record<QuizMode, { label: string; desc: string }> = {
  random: { label: 'ランダム', desc: '全問題からランダムに出題' },
  category: { label: 'カテゴリ別', desc: '指定したカテゴリから出題' },
  weak: { label: '苦手重点', desc: '正答率の低い問題を優先出題' },
};

export default function QuizSetupPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [exam, setExam] = useState<Exam | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [mode, setMode] = useState<QuizMode>('random');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const id = Number(examId);

  useEffect(() => {
    Promise.all([fetchExam(id), fetchCategories(id)])
      .then(([e, cats]) => {
        setExam(e);
        setCategories(cats);
        if (cats.length > 0) setSelectedCategoryId(cats[0].id);
      })
      .catch((e: Error) => { showToast(e.message); navigate('/'); })
      .finally(() => setLoading(false));
  }, [examId]);

  async function handleStart() {
    if (!exam) return;
    if (mode === 'category' && !selectedCategoryId) {
      showToast('カテゴリを選択してください');
      return;
    }
    setStarting(true);
    try {
      const session = await createQuizSession(
        exam.id,
        mode,
        mode === 'category' ? selectedCategoryId! : undefined
      );
      navigate(`/quiz/sessions/${session.id}`);
    } catch (e) {
      showToast((e as Error).message);
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <LoadingSpinner />
      </div>
    );
  }

  if (!exam) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-xl mx-auto px-6 py-10 space-y-6">
        <div>
          <Link to={`/exams/${exam.id}`} className="text-sm text-blue-600 hover:text-blue-800 mb-1 inline-block">
            ← {exam.name}
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">クイズ設定</h2>
        </div>

        {/* モード選択 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">出題モード</h3>
          {(Object.entries(MODE_LABELS) as [QuizMode, { label: string; desc: string }][]).map(([m, { label, desc }]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${mode === m ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <span className="font-medium text-gray-900">{label}</span>
              <span className="ml-2 text-sm text-gray-500">{desc}</span>
            </button>
          ))}
        </div>

        {/* カテゴリ選択（categoryモード時） */}
        {mode === 'category' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">カテゴリ</h3>
            <select
              value={selectedCategoryId ?? ''}
              onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}（{cat.questionCount}問）
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {starting ? '準備中...' : 'クイズを始める'}
        </button>
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
