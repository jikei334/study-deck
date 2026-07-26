import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import db from '../db/client.js';
import { migrate } from '../db/migrate.js';

beforeEach(() => {
  migrate();
  db.exec('DELETE FROM quiz_answers; DELETE FROM quiz_sessions; DELETE FROM choices; DELETE FROM questions; DELETE FROM categories; DELETE FROM exams;');
});

function seedExamAndCategories() {
  const examId = (db.prepare("INSERT INTO exams (name) VALUES ('Test Exam')").run().lastInsertRowid) as number;
  const cat1Id = (db.prepare("INSERT INTO categories (exam_id, name, sort_order) VALUES (?, 'カテゴリA', 1)").run(examId).lastInsertRowid) as number;
  const cat2Id = (db.prepare("INSERT INTO categories (exam_id, name, sort_order) VALUES (?, 'カテゴリB', 2)").run(examId).lastInsertRowid) as number;
  return { examId, cat1Id, cat2Id };
}

describe('GET /api/exams/:examId/categories', () => {
  it('カテゴリ一覧をsort_order順で返す', async () => {
    const { examId } = seedExamAndCategories();
    const res = await app.request(`/api/exams/${examId}/categories`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('カテゴリA');
    expect(body[1].name).toBe('カテゴリB');
  });

  it('questionCountが正しく集計される', async () => {
    const { examId, cat1Id } = seedExamAndCategories();
    db.prepare("INSERT INTO questions (category_id, text) VALUES (?, 'Q1')").run(cat1Id);
    db.prepare("INSERT INTO questions (category_id, text) VALUES (?, 'Q2')").run(cat1Id);
    const res = await app.request(`/api/exams/${examId}/categories`);
    const body = await res.json();
    expect(body[0].questionCount).toBe(2);
    expect(body[1].questionCount).toBe(0);
  });

  it('回答なしのカテゴリはcorrectRateがnull', async () => {
    const { examId } = seedExamAndCategories();
    const res = await app.request(`/api/exams/${examId}/categories`);
    const body = await res.json();
    expect(body[0].correctRate).toBeNull();
  });

  it('回答ありのカテゴリはcorrectRateが正しく計算される', async () => {
    const { examId, cat1Id } = seedExamAndCategories();
    const q1Id = (db.prepare("INSERT INTO questions (category_id, text) VALUES (?, 'Q1')").run(cat1Id).lastInsertRowid) as number;
    const q2Id = (db.prepare("INSERT INTO questions (category_id, text) VALUES (?, 'Q2')").run(cat1Id).lastInsertRowid) as number;
    const c1Id = (db.prepare("INSERT INTO choices (question_id, text, is_correct) VALUES (?, 'A', 1)").run(q1Id).lastInsertRowid) as number;
    const c2Id = (db.prepare("INSERT INTO choices (question_id, text, is_correct) VALUES (?, 'B', 0)").run(q2Id).lastInsertRowid) as number;
    const sessId = (db.prepare("INSERT INTO quiz_sessions (exam_id, mode, question_ids) VALUES (?, 'random', '[]')").run(examId).lastInsertRowid) as number;
    db.prepare("INSERT INTO quiz_answers (session_id, question_id, selected_choice_id, is_correct) VALUES (?, ?, ?, 1)").run(sessId, q1Id, c1Id);
    db.prepare("INSERT INTO quiz_answers (session_id, question_id, selected_choice_id, is_correct) VALUES (?, ?, ?, 0)").run(sessId, q2Id, c2Id);

    const res = await app.request(`/api/exams/${examId}/categories`);
    const body = await res.json();
    expect(body[0].correctRate).toBeCloseTo(0.5, 2);
  });

  it('存在しない試験IDで404を返す', async () => {
    const res = await app.request('/api/exams/9999/categories');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('試験が見つかりません');
  });

  it('数値でないIDで404を返す', async () => {
    const res = await app.request('/api/exams/abc/categories');
    expect(res.status).toBe(404);
  });

  it("SQLインジェクションを含むexamIdで安全に処理される", async () => {
    const res = await app.request("/api/exams/1 OR 1=1/categories");
    expect(res.status).toBe(404);
  });
});

describe('GET /api/exams/:examId/stats', () => {
  it('回答なしのとき空配列を返す', async () => {
    const { examId } = seedExamAndCategories();
    const res = await app.request(`/api/exams/${examId}/stats`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.categoryStats).toEqual([]);
    expect(body.recentSessions).toEqual([]);
  });

  it('完了セッションのみrecentSessionsに含まれる', async () => {
    const { examId } = seedExamAndCategories();
    db.prepare("INSERT INTO quiz_sessions (exam_id, mode, question_ids, completed_at) VALUES (?, 'random', '[]', '2026-07-25T10:00:00Z')").run(examId);
    db.prepare("INSERT INTO quiz_sessions (exam_id, mode, question_ids) VALUES (?, 'random', '[]')").run(examId);
    const res = await app.request(`/api/exams/${examId}/stats`);
    const body = await res.json();
    expect(body.recentSessions).toHaveLength(1);
  });

  it('categoryStatsが正しく集計される', async () => {
    const { examId, cat1Id } = seedExamAndCategories();
    const qId = (db.prepare("INSERT INTO questions (category_id, text) VALUES (?, 'Q1')").run(cat1Id).lastInsertRowid) as number;
    const cId = (db.prepare("INSERT INTO choices (question_id, text, is_correct) VALUES (?, 'A', 1)").run(qId).lastInsertRowid) as number;
    const sessId = (db.prepare("INSERT INTO quiz_sessions (exam_id, mode, question_ids) VALUES (?, 'random', '[]')").run(examId).lastInsertRowid) as number;
    db.prepare("INSERT INTO quiz_answers (session_id, question_id, selected_choice_id, is_correct) VALUES (?, ?, ?, 1)").run(sessId, qId, cId);

    const res = await app.request(`/api/exams/${examId}/stats`);
    const body = await res.json();
    expect(body.categoryStats).toHaveLength(1);
    expect(body.categoryStats[0].categoryName).toBe('カテゴリA');
    expect(body.categoryStats[0].totalAnswered).toBe(1);
    expect(body.categoryStats[0].correctCount).toBe(1);
    expect(body.categoryStats[0].correctRate).toBe(1);
  });

  it('recentSessionsが新しい順に最大10件返る', async () => {
    const { examId } = seedExamAndCategories();
    for (let i = 1; i <= 12; i++) {
      db.prepare("INSERT INTO quiz_sessions (exam_id, mode, question_ids, completed_at) VALUES (?, 'random', '[]', ?)").run(examId, `2026-07-${String(i).padStart(2, '0')}T00:00:00Z`);
    }
    const res = await app.request(`/api/exams/${examId}/stats`);
    const body = await res.json();
    expect(body.recentSessions).toHaveLength(10);
    expect(body.recentSessions[0].completedAt).toContain('07-12');
  });

  it('存在しない試験IDで404を返す', async () => {
    const res = await app.request('/api/exams/9999/stats');
    expect(res.status).toBe(404);
  });
});
