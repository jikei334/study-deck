import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import db from '../db/client.js';
import { migrate } from '../db/migrate.js';

beforeEach(() => {
  migrate();
  db.exec('DELETE FROM quiz_answers; DELETE FROM quiz_sessions; DELETE FROM choices; DELETE FROM questions; DELETE FROM terms; DELETE FROM categories; DELETE FROM exams;');
});

function seedData() {
  const examId = (db.prepare("INSERT INTO exams (name) VALUES ('Test Exam')").run().lastInsertRowid) as number;
  const cat1Id = (db.prepare("INSERT INTO categories (exam_id, name, sort_order) VALUES (?, 'ストレージ', 1)").run(examId).lastInsertRowid) as number;
  const cat2Id = (db.prepare("INSERT INTO categories (exam_id, name, sort_order) VALUES (?, 'データベース', 2)").run(examId).lastInsertRowid) as number;

  const t1Id = (db.prepare("INSERT INTO terms (category_id, name, description) VALUES (?, 'Amazon S3', 'オブジェクトストレージサービス')").run(cat1Id).lastInsertRowid) as number;
  const t2Id = (db.prepare("INSERT INTO terms (category_id, name, description) VALUES (?, 'Amazon EBS', 'ブロックストレージサービス')").run(cat1Id).lastInsertRowid) as number;
  const t3Id = (db.prepare("INSERT INTO terms (category_id, name, description) VALUES (?, 'Amazon RDS', 'リレーショナルデータベースサービス')").run(cat2Id).lastInsertRowid) as number;

  return { examId, cat1Id, cat2Id, t1Id, t2Id, t3Id };
}

describe('GET /api/exams/:examId/terms', () => {
  it('全用語を返す', async () => {
    const { examId } = seedData();
    const res = await app.request(`/api/exams/${examId}/terms`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(3);
    expect(body[0].categoryName).toBeDefined();
    expect(body[0].examId).toBe(examId);
  });

  it('categoryIdで絞り込める', async () => {
    const { examId, cat1Id } = seedData();
    const res = await app.request(`/api/exams/${examId}/terms?categoryId=${cat1Id}`);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body.every((t: { categoryId: number }) => t.categoryId === cat1Id)).toBe(true);
  });

  it('?q=S3でFTS検索できる', async () => {
    const { examId } = seedData();
    const res = await app.request(`/api/exams/${examId}/terms?q=S3`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Amazon S3');
  });

  it('?q=ストレージで複数ヒット', async () => {
    const { examId } = seedData();
    const res = await app.request(`/api/exams/${examId}/terms?q=ストレージ`);
    const body = await res.json();
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it('?q=存在しないキーワードで空配列', async () => {
    const { examId } = seedData();
    const res = await app.request(`/api/exams/${examId}/terms?q=xyznotfound`);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });

  it('存在しない試験IDで404', async () => {
    const res = await app.request('/api/exams/9999/terms');
    expect(res.status).toBe(404);
  });

  it('数値でないIDで404', async () => {
    const res = await app.request('/api/exams/abc/terms');
    expect(res.status).toBe(404);
  });

  it('SQLインジェクションを含むqで安全に処理される', async () => {
    const { examId } = seedData();
    const res = await app.request(`/api/exams/${examId}/terms?q=' OR '1'='1`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/terms', () => {
  it('用語を作成できる', async () => {
    const { cat1Id } = seedData();
    const res = await app.request('/api/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: cat1Id, name: '新用語', description: '新しい説明' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('新用語');
    expect(body.description).toBe('新しい説明');
    expect(body.id).toBeDefined();
  });

  it('nameが空で400', async () => {
    const { cat1Id } = seedData();
    const res = await app.request('/api/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: cat1Id, name: '', description: '説明' }),
    });
    expect(res.status).toBe(400);
  });

  it('descriptionが空で400', async () => {
    const { cat1Id } = seedData();
    const res = await app.request('/api/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: cat1Id, name: '用語', description: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('categoryIdが未指定で400', async () => {
    const res = await app.request('/api/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '用語', description: '説明' }),
    });
    expect(res.status).toBe(400);
  });

  it('存在しないcategoryIdで404', async () => {
    const res = await app.request('/api/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: 9999, name: '用語', description: '説明' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/terms/:termId', () => {
  it('用語を更新できる', async () => {
    const { t1Id } = seedData();
    const res = await app.request(`/api/terms/${t1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '更新後', description: '更新後の説明' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('更新後');
    expect(body.description).toBe('更新後の説明');
  });

  it('存在しない用語IDで404', async () => {
    const res = await app.request('/api/terms/9999', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '更新', description: '説明' }),
    });
    expect(res.status).toBe(404);
  });

  it('nameが空で400', async () => {
    const { t1Id } = seedData();
    const res = await app.request(`/api/terms/${t1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', description: '説明' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/terms/:termId', () => {
  it('用語を削除できる', async () => {
    const { t1Id } = seedData();
    const res = await app.request(`/api/terms/${t1Id}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    const check = db.prepare('SELECT id FROM terms WHERE id = ?').get(t1Id);
    expect(check).toBeUndefined();
  });

  it('存在しない用語IDで404', async () => {
    const res = await app.request('/api/terms/9999', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('数値でないIDで404', async () => {
    const res = await app.request('/api/terms/abc', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('削除後FTS索引からも除去される', async () => {
    const { examId, t1Id } = seedData();
    await app.request(`/api/terms/${t1Id}`, { method: 'DELETE' });
    const res = await app.request(`/api/exams/${examId}/terms?q=S3`);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });
});
