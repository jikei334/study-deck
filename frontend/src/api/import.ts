const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

export interface ImportResult {
  imported: number;
  errors: { row: number; message: string }[];
}

export async function importQuestionsCSV(examId: number, file: File): Promise<ImportResult> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_BASE}/api/exams/${examId}/import/questions`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `インポートに失敗しました (${res.status})`);
  }
  return res.json();
}

export async function importTermsCSV(examId: number, file: File): Promise<ImportResult> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_BASE}/api/exams/${examId}/import/terms`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `インポートに失敗しました (${res.status})`);
  }
  return res.json();
}
