import { useState } from 'react';
import type { Question, Category } from '../../types';
import type { ChoiceInput } from '../../api/questions';

interface Props {
  categories: Category[];
  initial?: Question;
  onSubmit: (categoryId: number, text: string, explanation: string | null, choices: ChoiceInput[]) => Promise<void>;
  onCancel: () => void;
}

const emptyChoices = (): ChoiceInput[] => [
  { text: '', isCorrect: true, explanation: null, sortOrder: 1 },
  { text: '', isCorrect: false, explanation: null, sortOrder: 2 },
  { text: '', isCorrect: false, explanation: null, sortOrder: 3 },
  { text: '', isCorrect: false, explanation: null, sortOrder: 4 },
];

export default function QuestionForm({ categories, initial, onSubmit, onCancel }: Props) {
  const [categoryId, setCategoryId] = useState<number>(initial?.categoryId ?? categories[0]?.id ?? 0);
  const [text, setText] = useState(initial?.text ?? '');
  const [explanation, setExplanation] = useState(initial?.explanation ?? '');
  const [choices, setChoices] = useState<ChoiceInput[]>(
    initial?.choices.map(c => ({ text: c.text, isCorrect: c.isCorrect ?? false, explanation: c.explanation ?? null, sortOrder: c.sortOrder })) ?? emptyChoices()
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function setCorrect(idx: number) {
    setChoices(prev => prev.map((c, i) => ({ ...c, isCorrect: i === idx })));
  }

  function setChoiceText(idx: number, value: string) {
    setChoices(prev => prev.map((c, i) => i === idx ? { ...c, text: value } : c));
  }

  function setChoiceExplanation(idx: number, value: string) {
    setChoices(prev => prev.map((c, i) => i === idx ? { ...c, explanation: value || null } : c));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!text.trim()) { setError('問題文は必須です'); return; }
    if (choices.some(c => !c.text.trim())) { setError('全ての選択肢テキストは必須です'); return; }

    setSubmitting(true);
    try {
      await onSubmit(categoryId, text.trim(), explanation.trim() || null, choices);
    } catch {
      setError('保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
        <select
          value={categoryId}
          onChange={e => setCategoryId(Number(e.target.value))}
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">問題文 <span className="text-red-500">*</span></label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="問題文を入力"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">問題の解説</label>
        <textarea
          value={explanation}
          onChange={e => setExplanation(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="省略可"
        />
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">選択肢（正解を1つ選択）</p>
        <div className="space-y-3">
          {choices.map((c, i) => (
            <div key={i} className="border border-gray-200 rounded p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={c.isCorrect}
                  onChange={() => setCorrect(i)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-500">選択肢{i + 1}</span>
                {c.isCorrect && <span className="text-xs text-green-600 font-medium">正解</span>}
              </div>
              <input
                type="text"
                value={c.text}
                onChange={e => setChoiceText(i, e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder={`選択肢${i + 1}のテキスト`}
              />
              <input
                type="text"
                value={c.explanation ?? ''}
                onChange={e => setChoiceExplanation(i, e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="選択肢の解説（省略可）"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50">
          キャンセル
        </button>
        <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {submitting ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  );
}
