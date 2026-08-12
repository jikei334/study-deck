import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchExams, createExam, updateExam, deleteExam } from '../api/exams';
import { fetchCategories, createCategory, updateCategory, deleteCategory } from '../api/categories';
import { fetchQuestions, createQuestion, updateQuestion, deleteQuestion } from '../api/questions';
import { fetchTerms, createTerm, updateTerm, deleteTerm } from '../api/terms';
import { importQuestionsCSV, importTermsCSV } from '../api/import';
import type { ImportResult } from '../api/import';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import QuestionForm from '../components/admin/QuestionForm';
import TermForm from '../components/admin/TermForm';
import type { Exam, Category, Question, Term } from '../types';
import type { ChoiceInput } from '../api/questions';

type Tab = 'exams' | 'categories' | 'questions' | 'terms' | 'import';

function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
      <Link to="/" className="text-gray-500 hover:text-gray-700 text-sm">← 試験一覧</Link>
      <h1 className="text-xl font-bold text-gray-900">管理画面</h1>
    </header>
  );
}

interface DeleteTarget {
  label: string;
  onConfirm: () => Promise<void>;
}

export default function AdminPage() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const initialExamId = searchParams.get('examId') ? Number(searchParams.get('examId')) : null;

  const [tab, setTab] = useState<Tab>('exams');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(initialExamId);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // フォーム状態
  const [showExamForm, setShowExamForm] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [examName, setExamName] = useState('');
  const [examDesc, setExamDesc] = useState('');

  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catOrder, setCatOrder] = useState(0);

  const [showQForm, setShowQForm] = useState(false);
  const [editingQ, setEditingQ] = useState<Question | null>(null);

  const [showTermForm, setShowTermForm] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);

  // インポート用状態
  const [importType, setImportType] = useState<'questions' | 'terms'>('questions');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // 試験一覧を初期ロード
  useEffect(() => {
    fetchExams()
      .then(data => {
        setExams(data);
        setSelectedExamId(prev => prev !== null ? prev : (data[0]?.id ?? null));
      })
      .catch(() => showToast('試験の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 試験変更時: カテゴリと用語をまとめてロード
  useEffect(() => {
    if (selectedExamId === null) return;
    let cancelled = false;
    setCategories([]);
    setQuestions([]);
    setTerms([]);
    setSelectedCategoryId(null);
    setTabLoading(true);

    Promise.all([
      fetchCategories(selectedExamId),
      fetchTerms(selectedExamId),
    ])
      .then(([cats, trms]) => {
        if (cancelled) return;
        setCategories(cats);
        setTerms(trms);
        if (cats.length > 0) {
          setSelectedCategoryId(cats[0].id);
          fetchQuestions(cats[0].id)
            .then(qs => { if (!cancelled) setQuestions(qs); })
            .catch(() => {});
        }
      })
      .catch(() => showToast('データの取得に失敗しました'))
      .finally(() => { if (!cancelled) setTabLoading(false); });

    return () => { cancelled = true; };
  }, [selectedExamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // リフレッシュ関数
  async function reloadCategories() {
    if (selectedExamId === null) return;
    const data = await fetchCategories(selectedExamId);
    setCategories(data);
  }

  async function reloadQuestions() {
    if (selectedCategoryId === null) return;
    setQuestions(await fetchQuestions(selectedCategoryId));
  }

  async function reloadTerms() {
    if (selectedExamId === null) return;
    setTerms(await fetchTerms(selectedExamId));
  }

  async function reloadExams() {
    const data = await fetchExams();
    setExams(data);
  }

  // カテゴリ選択変更時に問題を再ロード
  useEffect(() => {
    if (selectedCategoryId === null) { setQuestions([]); return; }
    fetchQuestions(selectedCategoryId)
      .then(setQuestions)
      .catch(() => {});
  }, [selectedCategoryId]);

  // ---- 試験フォーム ----
  function openExamForm(exam?: Exam) {
    setEditingExam(exam ?? null);
    setExamName(exam?.name ?? '');
    setExamDesc(exam?.description ?? '');
    setShowExamForm(true);
  }

  async function submitExamForm(e: React.FormEvent) {
    e.preventDefault();
    if (!examName.trim()) return;
    try {
      if (editingExam) {
        await updateExam(editingExam.id, examName.trim(), examDesc.trim() || undefined);
      } else {
        const created = await createExam(examName.trim(), examDesc.trim() || undefined);
        setSelectedExamId(created.id);
      }
      setShowExamForm(false);
      await reloadExams();
    } catch {
      showToast('保存に失敗しました');
    }
  }

  // ---- カテゴリフォーム ----
  function openCatForm(cat?: Category) {
    setEditingCat(cat ?? null);
    setCatName(cat?.name ?? '');
    setCatOrder(cat?.sortOrder ?? (categories.length + 1));
    setShowCatForm(true);
  }

  async function submitCatForm(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim() || selectedExamId === null) return;
    try {
      if (editingCat) {
        await updateCategory(editingCat.id, catName.trim(), catOrder);
      } else {
        await createCategory(selectedExamId, catName.trim(), catOrder);
      }
      setShowCatForm(false);
      await reloadCategories();
    } catch {
      showToast('保存に失敗しました');
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

  async function submitImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile || selectedExamId === null) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = importType === 'questions'
        ? await importQuestionsCSV(selectedExamId, importFile)
        : await importTermsCSV(selectedExamId, importFile);
      setImportResult(result);
      if (result.imported > 0) {
        showToast(`${result.imported}件インポートしました`);
        // データを再ロード
        const [cats, trms] = await Promise.all([
          fetchCategories(selectedExamId),
          fetchTerms(selectedExamId),
        ]);
        setCategories(cats);
        setTerms(trms);
        if (cats.length > 0) {
          setSelectedCategoryId(cats[0].id);
          fetchQuestions(cats[0].id).then(setQuestions).catch(() => {});
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'インポートに失敗しました');
    } finally {
      setImporting(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'exams', label: '試験' },
    { key: 'categories', label: 'カテゴリ' },
    { key: 'questions', label: '問題' },
    { key: 'terms', label: '用語' },
    { key: 'import', label: 'インポート' },
  ];

  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* 試験セレクタ */}
      {exams.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
          <span className="text-sm text-gray-500 shrink-0">対象試験:</span>
          <select
            value={selectedExamId ?? ''}
            onChange={e => setSelectedExamId(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          >
            {exams.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* タブ */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {tabLoading && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!tabLoading && (
          <>
            {/* ===== 試験タブ ===== */}
            {tab === 'exams' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">試験一覧</h2>
                  <button
                    onClick={() => openExamForm()}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    + 新規作成
                  </button>
                </div>

                {showExamForm && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                      {editingExam ? '試験を編集' : '試験を新規作成'}
                    </h3>
                    <form onSubmit={submitExamForm} className="space-y-3">
                      <input
                        type="text"
                        value={examName}
                        onChange={e => setExamName(e.target.value)}
                        placeholder="試験名 *"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      />
                      <input
                        type="text"
                        value={examDesc}
                        onChange={e => setExamDesc(e.target.value)}
                        placeholder="説明（省略可）"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setShowExamForm(false)} className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">キャンセル</button>
                        <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">保存</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {exams.length === 0 && (
                    <p className="p-6 text-sm text-gray-400 text-center">試験がありません</p>
                  )}
                  {exams.map(exam => (
                    <div key={exam.id} className="px-6 py-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{exam.name}</p>
                        {exam.description && <p className="text-sm text-gray-500 mt-0.5">{exam.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openExamForm(exam)}
                          className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => setDeleteTarget({
                            label: `試験「${exam.name}」を削除しますか？（関連するカテゴリ・問題・用語もすべて削除されます）`,
                            onConfirm: async () => {
                              await deleteExam(exam.id);
                              if (selectedExamId === exam.id) setSelectedExamId(null);
                              await reloadExams();
                            },
                          })}
                          className="px-3 py-1.5 border border-red-300 rounded text-sm text-red-600 hover:bg-red-50"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== カテゴリタブ ===== */}
            {tab === 'categories' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">
                    カテゴリ一覧{selectedExam ? ` — ${selectedExam.name}` : ''}
                  </h2>
                  {selectedExamId !== null && (
                    <button
                      onClick={() => openCatForm()}
                      className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      + 新規作成
                    </button>
                  )}
                </div>

                {showCatForm && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                      {editingCat ? 'カテゴリを編集' : 'カテゴリを新規作成'}
                    </h3>
                    <form onSubmit={submitCatForm} className="space-y-3">
                      <input
                        type="text"
                        value={catName}
                        onChange={e => setCatName(e.target.value)}
                        placeholder="カテゴリ名 *"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      />
                      <input
                        type="number"
                        value={catOrder}
                        onChange={e => setCatOrder(Number(e.target.value))}
                        placeholder="表示順"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setShowCatForm(false)} className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">キャンセル</button>
                        <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">保存</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {categories.length === 0 && (
                    <p className="p-6 text-sm text-gray-400 text-center">カテゴリがありません</p>
                  )}
                  {categories.map(cat => (
                    <div key={cat.id} className="px-6 py-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{cat.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">問題数: {cat.questionCount} / 表示順: {cat.sortOrder}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openCatForm(cat)}
                          className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => setDeleteTarget({
                            label: `カテゴリ「${cat.name}」を削除しますか？（関連する問題・用語もすべて削除されます）`,
                            onConfirm: async () => {
                              await deleteCategory(cat.id);
                              if (selectedCategoryId === cat.id) setSelectedCategoryId(null);
                              await reloadCategories();
                            },
                          })}
                          className="px-3 py-1.5 border border-red-300 rounded text-sm text-red-600 hover:bg-red-50"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== 問題タブ ===== */}
            {tab === 'questions' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">問題一覧</h2>
                  <div className="flex gap-3 items-center">
                    <select
                      value={selectedCategoryId ?? ''}
                      onChange={e => setSelectedCategoryId(Number(e.target.value))}
                      className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                    >
                      {categories.length === 0 && <option value="" disabled>カテゴリなし</option>}
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {selectedCategoryId !== null && !showQForm && (
                      <button
                        onClick={() => { setEditingQ(null); setShowQForm(true); }}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        + 新規作成
                      </button>
                    )}
                  </div>
                </div>

                {showQForm && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                      {editingQ ? '問題を編集' : '問題を新規作成'}
                    </h3>
                    <QuestionForm
                      categories={categories}
                      initial={editingQ ?? undefined}
                      onSubmit={async (catId, text, explanation, choices: ChoiceInput[]) => {
                        if (editingQ) {
                          await updateQuestion(editingQ.id, text, explanation, choices);
                        } else {
                          await createQuestion(catId, text, explanation, choices);
                          setSelectedCategoryId(catId);
                        }
                        setShowQForm(false);
                        await reloadQuestions();
                      }}
                      onCancel={() => setShowQForm(false)}
                    />
                  </div>
                )}

                <div className="space-y-3">
                  {questions.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">問題がありません</p>
                  )}
                  {questions.map((q, idx) => (
                    <div key={q.id} className="bg-white rounded-lg border border-gray-200 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-500 mb-1">問題 {idx + 1}</p>
                          <p className="text-gray-900">{q.text}</p>
                          {q.explanation && <p className="text-sm text-gray-500 mt-1">解説: {q.explanation}</p>}
                          <div className="mt-3 space-y-1">
                            {q.choices.map(c => (
                              <div key={c.id} className={`text-sm px-3 py-1.5 rounded ${c.isCorrect ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-600'}`}>
                                {c.isCorrect ? '✓ ' : '　'}{c.text}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => { setEditingQ(q); setShowQForm(true); }}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => setDeleteTarget({
                              label: 'この問題を削除しますか？',
                              onConfirm: async () => {
                                await deleteQuestion(q.id);
                                await reloadQuestions();
                              },
                            })}
                            className="px-3 py-1.5 border border-red-300 rounded text-sm text-red-600 hover:bg-red-50"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== インポートタブ ===== */}
            {tab === 'import' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">CSVインポート</h2>
                  <p className="text-sm text-gray-500">CSVファイルから問題・用語を一括インポートします。</p>
                </div>

                {selectedExamId === null ? (
                  <p className="text-sm text-gray-400 text-center py-8">対象試験を選択してください</p>
                ) : (
                  <form onSubmit={submitImport} className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
                    {/* インポート種別 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">インポート種別</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="importType"
                            value="questions"
                            checked={importType === 'questions'}
                            onChange={() => { setImportType('questions'); setImportResult(null); }}
                          />
                          問題
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="importType"
                            value="terms"
                            checked={importType === 'terms'}
                            onChange={() => { setImportType('terms'); setImportResult(null); }}
                          />
                          用語
                        </label>
                      </div>
                    </div>

                    {/* フォーマット説明 */}
                    <div className="bg-gray-50 rounded p-4 text-xs text-gray-600 space-y-1">
                      {importType === 'questions' ? (
                        <>
                          <p className="font-semibold text-gray-700">問題CSVフォーマット（1行目はヘッダー）</p>
                          <code className="block font-mono">categoryName,text,choice1,choice2,choice3,choice4,correctIndex,explanation</code>
                          <ul className="list-disc list-inside mt-1 space-y-0.5">
                            <li>correctIndex: 正解の選択肢番号（1〜4）</li>
                            <li>explanation: 解説（省略可）</li>
                            <li>カンマを含むフィールドは " で囲んでください</li>
                          </ul>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-gray-700">用語CSVフォーマット（1行目はヘッダー）</p>
                          <code className="block font-mono">categoryName,name,description</code>
                          <ul className="list-disc list-inside mt-1 space-y-0.5">
                            <li>全フィールド必須</li>
                            <li>カンマを含むフィールドは " で囲んでください</li>
                          </ul>
                        </>
                      )}
                    </div>

                    {/* ファイル選択 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">CSVファイル</label>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }}
                        className="block text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-4 file:rounded file:border file:border-gray-300 file:text-sm file:text-gray-600 file:cursor-pointer hover:file:bg-gray-50"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={!importFile || importing}
                        className="px-5 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {importing && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                        {importing ? 'インポート中...' : 'インポート実行'}
                      </button>
                    </div>
                  </form>
                )}

                {/* インポート結果 */}
                {importResult && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700">インポート結果</h3>
                    <div className="flex gap-6 text-sm">
                      <span className="text-green-700 font-medium">成功: {importResult.imported} 件</span>
                      {importResult.errors.length > 0 && (
                        <span className="text-red-600 font-medium">エラー: {importResult.errors.length} 件</span>
                      )}
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="border border-red-200 rounded divide-y divide-red-100">
                        {importResult.errors.map((e, i) => (
                          <div key={i} className="px-4 py-2 text-sm text-red-600">
                            <span className="font-medium">行 {e.row}:</span> {e.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ===== 用語タブ ===== */}
            {tab === 'terms' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">
                    用語一覧{selectedExam ? ` — ${selectedExam.name}` : ''}
                  </h2>
                  {selectedExamId !== null && !showTermForm && (
                    <button
                      onClick={() => { setEditingTerm(null); setShowTermForm(true); }}
                      className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      + 新規作成
                    </button>
                  )}
                </div>

                {showTermForm && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                      {editingTerm ? '用語を編集' : '用語を新規作成'}
                    </h3>
                    <TermForm
                      categories={categories}
                      initial={editingTerm ?? undefined}
                      onSubmit={async (catId, name, description) => {
                        if (editingTerm) {
                          await updateTerm(editingTerm.id, name, description);
                        } else {
                          await createTerm(catId, name, description);
                        }
                        setShowTermForm(false);
                        await reloadTerms();
                      }}
                      onCancel={() => setShowTermForm(false)}
                    />
                  </div>
                )}

                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {terms.length === 0 && (
                    <p className="p-6 text-sm text-gray-400 text-center">用語がありません</p>
                  )}
                  {terms.map(term => (
                    <div key={term.id} className="px-6 py-4 flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{term.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{term.categoryName}</p>
                        <p className="text-sm text-gray-600 mt-1">{term.description}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => { setEditingTerm(term); setShowTermForm(true); }}
                          className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => setDeleteTarget({
                            label: `用語「${term.name}」を削除しますか？`,
                            onConfirm: async () => {
                              await deleteTerm(term.id);
                              await reloadTerms();
                            },
                          })}
                          className="px-3 py-1.5 border border-red-300 rounded text-sm text-red-600 hover:bg-red-50"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* 削除確認ダイアログ */}
      {deleteTarget && (
        <ConfirmDialog
          message={deleteTarget.label}
          onConfirm={async () => {
            try {
              await deleteTarget.onConfirm();
            } catch {
              showToast('削除に失敗しました');
            } finally {
              setDeleteTarget(null);
            }
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
