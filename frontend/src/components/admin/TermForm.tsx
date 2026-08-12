import { useState } from 'react';
import type { Term, Category } from '../../types';

interface Props {
  categories: Category[];
  initial?: Term;
  onSubmit: (categoryId: number, name: string, description: string) => Promise<void>;
  onCancel: () => void;
}

export default function TermForm({ categories, initial, onSubmit, onCancel }: Props) {
  const [categoryId, setCategoryId] = useState<number>(initial?.categoryId ?? categories[0]?.id ?? 0);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('用語名は必須です'); return; }
    if (!description.trim()) { setError('説明は必須です'); return; }

    setSubmitting(true);
    try {
      await onSubmit(categoryId, name.trim(), description.trim());
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
        <label className="block text-sm font-medium text-gray-700 mb-1">用語名 <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="用語名を入力"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">説明 <span className="text-red-500">*</span></label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="用語の説明を入力"
        />
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
