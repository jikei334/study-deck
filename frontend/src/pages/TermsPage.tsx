import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchExam } from '../api/exams';
import { fetchCategories } from '../api/categories';
import { fetchTerms } from '../api/terms';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import type { Exam, Category, Term } from '../types';

export default function TermsPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [exam, setExam] = useState<Exam | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const id = Number(examId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([fetchExam(id), fetchCategories(id)])
      .then(([e, cats]) => {
        setExam(e);
        setCategories(cats);
      })
      .catch((e: Error) => { showToast(e.message); navigate('/'); })
      .finally(() => setInitialLoading(false));
  }, [examId]);

  // 初回ロードと検索条件変更時に用語を取得
  useEffect(() => {
    if (initialLoading) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      fetchTerms(id, query || undefined, selectedCategoryId ?? undefined)
        .then(setTerms)
        .catch((e: Error) => showToast(e.message))
        .finally(() => setSearching(false));
    }, query ? 300 : 0);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selectedCategoryId, initialLoading]);

  if (initialLoading) {
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
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <Link to={`/exams/${exam.id}`} className="text-sm text-blue-600 hover:text-blue-800 mb-1 inline-block">
            ← {exam.name}
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">用語検索</h2>
        </div>

        {/* 検索・フィルター */}
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="用語を検索..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={selectedCategoryId ?? ''}
            onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全カテゴリ</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* 検索結果 */}
        {searching ? (
          <LoadingSpinner />
        ) : terms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p>{query ? `「${query}」に一致する用語が見つかりません` : '用語がありません'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{terms.length} 件</p>
            {terms.map((term) => (
              <TermCard key={term.id} term={term} query={query} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TermCard({ term, query }: { term: Term; query: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{highlight(term.name, query)}</p>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{highlight(term.description, query)}</p>
        </div>
        <span className="shrink-0 text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-1">
          {term.categoryName}
        </span>
      </div>
    </div>
  );
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{part}</mark>
      : part
  );
}

function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <h1 className="text-2xl font-bold text-blue-600 tracking-tight">study-deck</h1>
    </header>
  );
}
