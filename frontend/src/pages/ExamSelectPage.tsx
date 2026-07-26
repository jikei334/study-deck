import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchExams } from '../api/exams';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import type { Exam } from '../types';

export default function ExamSelectPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    fetchExams()
      .then(setExams)
      .catch((e: Error) => showToast(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-blue-600 tracking-tight">study-deck</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold text-gray-800">試験を選択</h2>
          <button
            onClick={() => navigate('/admin')}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            + 試験を追加
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : exams.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-4">試験がまだ登録されていません</p>
            <button
              onClick={() => navigate('/admin')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              試験を追加する
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {exams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} onClick={() => navigate(`/exams/${exam.id}`)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ExamCard({ exam, onClick }: { exam: Exam; onClick: () => void }) {
  const correctRate = exam.overallCorrectRate != null
    ? `${Math.round(exam.overallCorrectRate * 100)}%`
    : '未受験';

  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-150"
    >
      <h3 className="text-lg font-bold text-gray-900 mb-1">{exam.name}</h3>
      {exam.description && (
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{exam.description}</p>
      )}
      <div className="flex gap-4 text-sm text-gray-600 mt-auto">
        <span>
          <span className="font-medium text-gray-900">{exam.totalSessions}</span> 回受験
        </span>
        <span>
          正答率: <span className="font-medium text-gray-900">{correctRate}</span>
        </span>
      </div>
    </button>
  );
}
