import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import db from '../db/client.js';
import { migrate } from '../db/migrate.js';

beforeEach(() => {
  migrate();
  db.exec('DELETE FROM quiz_answers; DELETE FROM quiz_sessions; DELETE FROM choices; DELETE FROM questions; DELETE FROM categories; DELETE FROM exams;');
});

function seedExam() {
  const examId = (db.prepare("INSERT INTO exams (name) VALUES ('Test Exam')").run().lastInsertRowid) as number;
  const cat1Id = (db.prepare("INSERT INTO categories (exam_id, name, sort_order) VALUES (?, 'カテゴリA', 1)").run(examId).lastInsertRowid) as number;
  const cat2Id = (db.prepare("INSERT INTO categories (exam_id, name, sort_order) VALUES (?, 'カテゴリB', 2)").run(examId).lastInsertRowid) as number;

  function addQuestion(categoryId: number, text: string) {
    const qId = (db.prepare("INSERT INTO questions (category_id, text, explanation) VALUES (?, ?, '解説')").run(categoryId, text).lastInsertRowid) as number;
    const c1Id = (db.prepare("INSERT INTO choices (question_id, text, is_correct, explanation, sort_order) VALUES (?, '正解', 1, '正解の説明', 1)").run(qId).lastInsertRowid) as number;
    const c2Id = (db.prepare("INSERT INTO choices (question_id, text, is_correct, explanation, sort_order) VALUES (?, '不正解', 0, '不正解の説明', 2)").run(qId).lastInsertRowid) as number;
    return { qId, c1Id, c2Id };
  }

  const q1 = addQuestion(cat1Id, 'Q1');
  const q2 = addQuestion(cat1Id, 'Q2');
  const q3 = addQuestion(cat2Id, 'Q3');

  return { examId, cat1Id, cat2Id, q1, q2, q3 };
}

describe('POST /api/quiz/sessions', () => {
  it('randomモードでセッションを作成できる', async () => {
    const { examId } = seedExam();
    const res = await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'random' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.examId).toBe(examId);
    expect(body.mode).toBe('random');
    expect(body.questions).toHaveLength(3);
    expect(body.questions[0].choices[0]).not.toHaveProperty('isCorrect');
  });

  it('categoryモードで指定カテゴリの問題だけが返る', async () => {
    const { examId, cat1Id } = seedExam();
    const res = await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'category', categoryId: cat1Id }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.questions).toHaveLength(2);
  });

  it('weakモードでセッションを作成できる', async () => {
    const { examId } = seedExam();
    const res = await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'weak' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.questions).toHaveLength(3);
  });

  it('categoryモードにcategoryIdが無いと400', async () => {
    const { examId } = seedExam();
    const res = await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'category' }),
    });
    expect(res.status).toBe(400);
  });

  it('無効なmodeで400', async () => {
    const { examId } = seedExam();
    const res = await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'invalid' }),
    });
    expect(res.status).toBe(400);
  });

  it('存在しない試験IDで404', async () => {
    const res = await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId: 9999, mode: 'random' }),
    });
    expect(res.status).toBe(404);
  });

  it('問題のないカテゴリでcategoryモードを作成すると400', async () => {
    const examId = (db.prepare("INSERT INTO exams (name) VALUES ('空試験')").run().lastInsertRowid) as number;
    const catId = (db.prepare("INSERT INTO categories (exam_id, name, sort_order) VALUES (?, '空カテゴリ', 1)").run(examId).lastInsertRowid) as number;
    const res = await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'category', categoryId: catId }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/quiz/sessions/:sessionId', () => {
  it('セッションを取得できる', async () => {
    const { examId } = seedExam();
    const created = await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'random' }),
    });
    const { id } = await created.json();

    const res = await app.request(`/api/quiz/sessions/${id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.questions).toHaveLength(3);
  });

  it('存在しないセッションIDで404', async () => {
    const res = await app.request('/api/quiz/sessions/9999');
    expect(res.status).toBe(404);
  });

  it('数値でないIDで404', async () => {
    const res = await app.request('/api/quiz/sessions/abc');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/quiz/sessions/:sessionId/answers', () => {
  it('正解を記録するとisCorrect=true', async () => {
    const { examId, q1 } = seedExam();
    const sess = await (await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'random' }),
    })).json();

    const res = await app.request(`/api/quiz/sessions/${sess.id}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q1.qId, selectedChoiceId: q1.c1Id }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.isCorrect).toBe(true);
    expect(body.correctChoiceId).toBe(q1.c1Id);
    expect(body.choices).toHaveLength(2);
    expect(body.choices[0].isCorrect).toBe(true);
    expect(body.questionExplanation).toBe('解説');
  });

  it('不正解を記録するとisCorrect=false', async () => {
    const { examId, q1 } = seedExam();
    const sess = await (await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'random' }),
    })).json();

    const res = await app.request(`/api/quiz/sessions/${sess.id}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q1.qId, selectedChoiceId: q1.c2Id }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.isCorrect).toBe(false);
  });

  it('同じ問題を2回回答すると409', async () => {
    const { examId, q1 } = seedExam();
    const sess = await (await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'random' }),
    })).json();

    await app.request(`/api/quiz/sessions/${sess.id}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q1.qId, selectedChoiceId: q1.c1Id }),
    });
    const res = await app.request(`/api/quiz/sessions/${sess.id}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q1.qId, selectedChoiceId: q1.c1Id }),
    });
    expect(res.status).toBe(409);
  });

  it('完了済みセッションへの回答は409', async () => {
    const { examId, q1 } = seedExam();
    const sess = await (await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'random' }),
    })).json();
    await app.request(`/api/quiz/sessions/${sess.id}/complete`, { method: 'PATCH' });

    const res = await app.request(`/api/quiz/sessions/${sess.id}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q1.qId, selectedChoiceId: q1.c1Id }),
    });
    expect(res.status).toBe(409);
  });

  it('存在しないセッションへの回答は404', async () => {
    const res = await app.request('/api/quiz/sessions/9999/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 1, selectedChoiceId: 1 }),
    });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/quiz/sessions/:sessionId/complete', () => {
  it('セッションを完了できる', async () => {
    const { examId } = seedExam();
    const sess = await (await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'random' }),
    })).json();

    const res = await app.request(`/api/quiz/sessions/${sess.id}/complete`, { method: 'PATCH' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // 再取得でcompletedAtが設定されていることを確認
    const fetched = await (await app.request(`/api/quiz/sessions/${sess.id}`)).json();
    expect(fetched.completedAt).not.toBeNull();
  });

  it('完了済みセッションの再完了もOK（冪等）', async () => {
    const { examId } = seedExam();
    const sess = await (await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'random' }),
    })).json();
    await app.request(`/api/quiz/sessions/${sess.id}/complete`, { method: 'PATCH' });

    const res = await app.request(`/api/quiz/sessions/${sess.id}/complete`, { method: 'PATCH' });
    expect(res.status).toBe(200);
  });

  it('存在しないセッションは404', async () => {
    const res = await app.request('/api/quiz/sessions/9999/complete', { method: 'PATCH' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/quiz/sessions/:sessionId/result', () => {
  async function createAndCompleteSession(examId: number, q1: { qId: number; c1Id: number; c2Id: number }, q2: { qId: number; c1Id: number }, q3: { qId: number; c2Id: number }) {
    const sess = await (await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'random' }),
    })).json();
    // q1正解、q2正解、q3不正解
    await app.request(`/api/quiz/sessions/${sess.id}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q1.qId, selectedChoiceId: q1.c1Id }),
    });
    await app.request(`/api/quiz/sessions/${sess.id}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q2.qId, selectedChoiceId: q2.c1Id }),
    });
    await app.request(`/api/quiz/sessions/${sess.id}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q3.qId, selectedChoiceId: q3.c2Id }),
    });
    await app.request(`/api/quiz/sessions/${sess.id}/complete`, { method: 'PATCH' });
    return sess.id;
  }

  it('完了セッションの結果が正しく取得できる', async () => {
    const { examId, q1, q2, q3 } = seedExam();
    const sessionId = await createAndCompleteSession(examId, q1, q2, q3);

    const res = await app.request(`/api/quiz/sessions/${sessionId}/result`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalCount).toBe(3);
    expect(body.correctCount).toBe(2);
    expect(body.correctRate).toBeCloseTo(2 / 3, 2);
    expect(body.answers).toHaveLength(3);
    expect(body.categoryStats).toHaveLength(2);
  });

  it('カテゴリ別統計が正しく集計される', async () => {
    const { examId, q1, q2, q3 } = seedExam();
    const sessionId = await createAndCompleteSession(examId, q1, q2, q3);

    const res = await app.request(`/api/quiz/sessions/${sessionId}/result`);
    const body = await res.json();
    const catA = body.categoryStats.find((s: { categoryName: string }) => s.categoryName === 'カテゴリA');
    expect(catA.total).toBe(2);
    expect(catA.correct).toBe(2);
    const catB = body.categoryStats.find((s: { categoryName: string }) => s.categoryName === 'カテゴリB');
    expect(catB.total).toBe(1);
    expect(catB.correct).toBe(0);
  });

  it('未完了セッションは404', async () => {
    const { examId } = seedExam();
    const sess = await (await app.request('/api/quiz/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, mode: 'random' }),
    })).json();

    const res = await app.request(`/api/quiz/sessions/${sess.id}/result`);
    expect(res.status).toBe(404);
  });

  it('存在しないセッションは404', async () => {
    const res = await app.request('/api/quiz/sessions/9999/result');
    expect(res.status).toBe(404);
  });
});
