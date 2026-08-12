import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import db from '../db/client.js';
import { migrate } from '../db/migrate.js';

beforeEach(() => {
  migrate();
  db.exec('DELETE FROM quiz_answers; DELETE FROM quiz_sessions; DELETE FROM choices; DELETE FROM questions; DELETE FROM terms; DELETE FROM categories; DELETE FROM exams;');
});

function seedExam(name = 'Test Exam') {
  return db.prepare('INSERT INTO exams (name) VALUES (?)').run(name).lastInsertRowid as number;
}

const QUESTIONS_CSV_HEADER = 'categoryName,text,choice1,choice2,choice3,choice4,correctIndex,explanation\n';
const TERMS_CSV_HEADER = 'categoryName,name,description\n';

// ---- multipartフォームデータ用ヘルパー ----
function makeFormData(csvContent: string, filename = 'test.csv'): FormData {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const file = new File([blob], filename, { type: 'text/csv' });
  const fd = new FormData();
  fd.append('file', file);
  return fd;
}

// ---- 問題インポート ----
describe('POST /api/exams/:examId/import/questions', () => {
  it('正常な問題CSVをインポートできる', async () => {
    const examId = seedExam();
    const csv = QUESTIONS_CSV_HEADER +
      'カテゴリA,問題1,選択肢1,選択肢2,選択肢3,選択肢4,1,解説1\n' +
      'カテゴリA,問題2,A,B,C,D,2,\n';
    const res = await app.request(`/api/exams/${examId}/import/questions`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(2);
    expect(body.errors).toHaveLength(0);

    const cats = db.prepare('SELECT * FROM categories WHERE exam_id = ?').all(examId) as any[];
    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe('カテゴリA');

    const qs = db.prepare('SELECT * FROM questions').all() as any[];
    expect(qs).toHaveLength(2);
  });

  it('複数カテゴリにまたがる問題をインポートできる', async () => {
    const examId = seedExam();
    const csv = QUESTIONS_CSV_HEADER +
      'カテゴリA,Q1,A,B,C,D,1,\n' +
      'カテゴリB,Q2,A,B,C,D,2,\n' +
      'カテゴリA,Q3,A,B,C,D,3,\n';
    const res = await app.request(`/api/exams/${examId}/import/questions`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(3);
    const cats = db.prepare('SELECT * FROM categories WHERE exam_id = ?').all(examId) as any[];
    expect(cats).toHaveLength(2);
  });

  it('correctIndexが1〜4の正しい選択肢をis_correct=1にする', async () => {
    const examId = seedExam();
    const csv = QUESTIONS_CSV_HEADER + 'カテゴリA,Q1,選A,選B,選C,選D,3,\n';
    await app.request(`/api/exams/${examId}/import/questions`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    const choices = db.prepare('SELECT * FROM choices ORDER BY sort_order').all() as any[];
    expect(choices).toHaveLength(4);
    expect(choices[2].is_correct).toBe(1);
    expect(choices[0].is_correct).toBe(0);
    expect(choices[1].is_correct).toBe(0);
    expect(choices[3].is_correct).toBe(0);
  });

  it('既存カテゴリと同名の場合は新規作成しない', async () => {
    const examId = seedExam();
    db.prepare("INSERT INTO categories (exam_id, name, sort_order) VALUES (?, 'カテゴリA', 1)").run(examId);
    const csv = QUESTIONS_CSV_HEADER + 'カテゴリA,Q1,A,B,C,D,1,\n';
    const res = await app.request(`/api/exams/${examId}/import/questions`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    expect(res.status).toBe(200);
    const cats = db.prepare('SELECT * FROM categories WHERE exam_id = ?').all(examId) as any[];
    expect(cats).toHaveLength(1);
  });

  it('列数不足の行はエラーになり他は正常にインポートされる', async () => {
    const examId = seedExam();
    const csv = QUESTIONS_CSV_HEADER +
      'カテゴリA,Q1,A,B,C\n' +
      'カテゴリA,Q2,A,B,C,D,1,\n';
    const res = await app.request(`/api/exams/${examId}/import/questions`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].row).toBe(2);
  });

  it('correctIndexが範囲外の行はエラーになる', async () => {
    const examId = seedExam();
    const csv = QUESTIONS_CSV_HEADER + 'カテゴリA,Q1,A,B,C,D,5,\n';
    const res = await app.request(`/api/exams/${examId}/import/questions`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    const body = await res.json();
    expect(body.imported).toBe(0);
    expect(body.errors[0].message).toContain('correctIndex');
  });

  it('ヘッダーのみのCSVでエラー', async () => {
    const examId = seedExam();
    const csv = QUESTIONS_CSV_HEADER;
    const res = await app.request(`/api/exams/${examId}/import/questions`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(0);
    expect(body.errors).toHaveLength(1);
  });

  it('存在しない試験IDで404', async () => {
    const csv = QUESTIONS_CSV_HEADER + 'カテゴリA,Q1,A,B,C,D,1,\n';
    const res = await app.request('/api/exams/9999/import/questions', {
      method: 'POST',
      body: makeFormData(csv),
    });
    expect(res.status).toBe(404);
  });

  it('数値でない試験IDで404', async () => {
    const res = await app.request('/api/exams/abc/import/questions', {
      method: 'POST',
      body: makeFormData(QUESTIONS_CSV_HEADER),
    });
    expect(res.status).toBe(404);
  });

  it('fileフィールドなしで400', async () => {
    const examId = seedExam();
    const res = await app.request(`/api/exams/${examId}/import/questions`, {
      method: 'POST',
      body: new FormData(),
    });
    expect(res.status).toBe(400);
  });

  it('text/csv ボディでも受け付ける', async () => {
    const examId = seedExam();
    const csv = QUESTIONS_CSV_HEADER + 'カテゴリA,Q1,A,B,C,D,1,解説\n';
    const res = await app.request(`/api/exams/${examId}/import/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csv,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(1);
  });

  it('引用符付きフィールドを正しくパースする', async () => {
    const examId = seedExam();
    const csv = QUESTIONS_CSV_HEADER + '"カテゴリA","問題,カンマあり",A,B,C,D,1,"解説,詳細"\n';
    const res = await app.request(`/api/exams/${examId}/import/questions`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(1);
    const q = db.prepare('SELECT text FROM questions').get() as any;
    expect(q.text).toBe('問題,カンマあり');
  });

  it('SQLインジェクションを含むデータでも安全に処理される', async () => {
    const examId = seedExam();
    const malicious = "'; DROP TABLE questions; --";
    const csv = QUESTIONS_CSV_HEADER + `"${malicious}","${malicious}",A,B,C,D,1,\n`;
    const res = await app.request(`/api/exams/${examId}/import/questions`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(1);
    const count = db.prepare('SELECT COUNT(*) as n FROM questions').get() as { n: number };
    expect(count.n).toBe(1);
  });
});

// ---- 用語インポート ----
describe('POST /api/exams/:examId/import/terms', () => {
  it('正常な用語CSVをインポートできる', async () => {
    const examId = seedExam();
    const csv = TERMS_CSV_HEADER +
      'カテゴリA,用語1,説明1\n' +
      'カテゴリA,用語2,説明2\n';
    const res = await app.request(`/api/exams/${examId}/import/terms`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(2);
    expect(body.errors).toHaveLength(0);

    const terms = db.prepare('SELECT * FROM terms').all() as any[];
    expect(terms).toHaveLength(2);
  });

  it('複数カテゴリにまたがる用語をインポートできる', async () => {
    const examId = seedExam();
    const csv = TERMS_CSV_HEADER +
      'カテゴリA,用語1,説明1\n' +
      'カテゴリB,用語2,説明2\n';
    const res = await app.request(`/api/exams/${examId}/import/terms`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(2);
    const cats = db.prepare('SELECT * FROM categories WHERE exam_id = ?').all(examId) as any[];
    expect(cats).toHaveLength(2);
  });

  it('列数不足の行はエラー', async () => {
    const examId = seedExam();
    const csv = TERMS_CSV_HEADER + 'カテゴリA,用語1\n';
    const res = await app.request(`/api/exams/${examId}/import/terms`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    const body = await res.json();
    expect(body.imported).toBe(0);
    expect(body.errors).toHaveLength(1);
  });

  it('descriptionが空の行はエラー', async () => {
    const examId = seedExam();
    const csv = TERMS_CSV_HEADER + 'カテゴリA,用語1,\n';
    const res = await app.request(`/api/exams/${examId}/import/terms`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    const body = await res.json();
    expect(body.imported).toBe(0);
    expect(body.errors[0].message).toContain('description');
  });

  it('ヘッダーのみのCSVでエラー', async () => {
    const examId = seedExam();
    const res = await app.request(`/api/exams/${examId}/import/terms`, {
      method: 'POST',
      body: makeFormData(TERMS_CSV_HEADER),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(0);
    expect(body.errors).toHaveLength(1);
  });

  it('存在しない試験IDで404', async () => {
    const csv = TERMS_CSV_HEADER + 'カテゴリA,用語1,説明1\n';
    const res = await app.request('/api/exams/9999/import/terms', {
      method: 'POST',
      body: makeFormData(csv),
    });
    expect(res.status).toBe(404);
  });

  it('text/csv ボディでも受け付ける', async () => {
    const examId = seedExam();
    const csv = TERMS_CSV_HEADER + 'カテゴリA,用語1,説明1\n';
    const res = await app.request(`/api/exams/${examId}/import/terms`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csv,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(1);
  });

  it('SQLインジェクションを含むデータでも安全に処理される', async () => {
    const examId = seedExam();
    const malicious = "'; DROP TABLE terms; --";
    const csv = TERMS_CSV_HEADER + `"カテゴリA","${malicious}","${malicious}"\n`;
    const res = await app.request(`/api/exams/${examId}/import/terms`, {
      method: 'POST',
      body: makeFormData(csv),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(1);
    const count = db.prepare('SELECT COUNT(*) as n FROM terms').get() as { n: number };
    expect(count.n).toBe(1);
  });
});
