import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import db from '../db/client.js';
import { migrate } from '../db/migrate.js';

beforeEach(() => {
  migrate();
  db.exec('DELETE FROM quiz_answers; DELETE FROM quiz_sessions; DELETE FROM choices; DELETE FROM questions; DELETE FROM categories; DELETE FROM exams;');
});

function seedData() {
  const examId = (db.prepare("INSERT INTO exams (name) VALUES ('Test Exam')").run().lastInsertRowid) as number;
  const catId = (db.prepare("INSERT INTO categories (exam_id, name, sort_order) VALUES (?, 'カテゴリA', 1)").run(examId).lastInsertRowid) as number;
  const qId = (db.prepare("INSERT INTO questions (category_id, text, explanation) VALUES (?, '既存の問題', '解説')").run(catId).lastInsertRowid) as number;
  db.prepare("INSERT INTO choices (question_id, text, is_correct, sort_order) VALUES (?, '正解', 1, 1)").run(qId);
  db.prepare("INSERT INTO choices (question_id, text, is_correct, sort_order) VALUES (?, '選択肢2', 0, 2)").run(qId);
  db.prepare("INSERT INTO choices (question_id, text, is_correct, sort_order) VALUES (?, '選択肢3', 0, 3)").run(qId);
  db.prepare("INSERT INTO choices (question_id, text, is_correct, sort_order) VALUES (?, '選択肢4', 0, 4)").run(qId);
  return { examId, catId, qId };
}

const validChoices = [
  { text: '正解', isCorrect: true, explanation: '正解の説明', sortOrder: 1 },
  { text: '選択肢2', isCorrect: false, explanation: null, sortOrder: 2 },
  { text: '選択肢3', isCorrect: false, explanation: null, sortOrder: 3 },
  { text: '選択肢4', isCorrect: false, explanation: null, sortOrder: 4 },
];

describe('GET /api/categories/:categoryId/questions', () => {
  it('問題一覧を選択肢付きで返す', async () => {
    const { catId } = seedData();
    const res = await app.request(`/api/categories/${catId}/questions`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].choices).toHaveLength(4);
    expect(body[0].text).toBe('既存の問題');
    expect(body[0].choices[0].isCorrect).toBe(true);
  });

  it('存在しないカテゴリIDで404', async () => {
    const res = await app.request('/api/categories/9999/questions');
    expect(res.status).toBe(404);
  });

  it('数値でないIDで404', async () => {
    const res = await app.request('/api/categories/abc/questions');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/questions', () => {
  it('問題と選択肢4つを作成できる', async () => {
    const { catId } = seedData();
    const res = await app.request('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: catId, text: '新しい問題', explanation: '解説', choices: validChoices }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.text).toBe('新しい問題');
    expect(body.explanation).toBe('解説');
    expect(body.choices).toHaveLength(4);
    expect(body.choices.filter((c: { isCorrect: boolean }) => c.isCorrect)).toHaveLength(1);
  });

  it('explanationなしで作成できる', async () => {
    const { catId } = seedData();
    const res = await app.request('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: catId, text: '問題', choices: validChoices }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.explanation).toBeNull();
  });

  it('問題文が空で400', async () => {
    const { catId } = seedData();
    const res = await app.request('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: catId, text: '', choices: validChoices }),
    });
    expect(res.status).toBe(400);
  });

  it('選択肢が4つでないと400', async () => {
    const { catId } = seedData();
    const res = await app.request('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: catId, text: '問題', choices: validChoices.slice(0, 3) }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('4');
  });

  it('正解が1つでないと400', async () => {
    const { catId } = seedData();
    const twoCorrect = validChoices.map((c, i) => ({ ...c, isCorrect: i < 2 }));
    const res = await app.request('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: catId, text: '問題', choices: twoCorrect }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('1');
  });

  it('正解が0つでも400', async () => {
    const { catId } = seedData();
    const noCorrect = validChoices.map(c => ({ ...c, isCorrect: false }));
    const res = await app.request('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: catId, text: '問題', choices: noCorrect }),
    });
    expect(res.status).toBe(400);
  });

  it('存在しないcategoryIdで404', async () => {
    const res = await app.request('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: 9999, text: '問題', choices: validChoices }),
    });
    expect(res.status).toBe(404);
  });

  it('categoryId未指定で400', async () => {
    const res = await app.request('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '問題', choices: validChoices }),
    });
    expect(res.status).toBe(400);
  });

  it('SQLインジェクションを含む問題文でも安全に作成できる', async () => {
    const { catId } = seedData();
    const malicious = "'; DROP TABLE questions; --";
    const res = await app.request('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: catId, text: malicious, choices: validChoices }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.text).toBe(malicious);
    const count = db.prepare('SELECT COUNT(*) as n FROM questions').get() as { n: number };
    expect(count.n).toBeGreaterThan(0);
  });
});

describe('PUT /api/questions/:questionId', () => {
  it('問題と選択肢を更新できる', async () => {
    const { qId } = seedData();
    const updated = validChoices.map((c, i) => ({ ...c, text: `更新${i + 1}`, isCorrect: i === 1 }));
    const res = await app.request(`/api/questions/${qId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '更新後の問題', explanation: '更新解説', choices: updated }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe('更新後の問題');
    expect(body.explanation).toBe('更新解説');
    expect(body.choices[1].isCorrect).toBe(true);
    expect(body.choices[0].isCorrect).toBe(false);
  });

  it('存在しない問題IDで404', async () => {
    const res = await app.request('/api/questions/9999', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '更新', choices: validChoices }),
    });
    expect(res.status).toBe(404);
  });

  it('更新時も選択肢4つ・正解1つのバリデーションが効く', async () => {
    const { qId } = seedData();
    const res = await app.request(`/api/questions/${qId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '問題', choices: validChoices.slice(0, 2) }),
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/questions/:questionId', () => {
  it('問題を削除できる', async () => {
    const { qId } = seedData();
    const res = await app.request(`/api/questions/${qId}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    const check = db.prepare('SELECT id FROM questions WHERE id = ?').get(qId);
    expect(check).toBeUndefined();
    const choiceCheck = db.prepare('SELECT id FROM choices WHERE question_id = ?').get(qId);
    expect(choiceCheck).toBeUndefined();
  });

  it('存在しない問題IDで404', async () => {
    const res = await app.request('/api/questions/9999', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('数値でないIDで404', async () => {
    const res = await app.request('/api/questions/abc', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
