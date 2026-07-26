import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import db from '../db/client.js';
import { migrate } from '../db/migrate.js';

// テスト用インメモリDBを使えないため、テスト前後にexamsをクリーンアップ
beforeEach(() => {
  migrate();
  db.exec('DELETE FROM exams');
});

describe('GET /api/exams', () => {
  it('試験が0件のとき空配列を返す', async () => {
    const res = await app.request('/api/exams');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('試験が複数件あるとき全件返す', async () => {
    db.exec(`
      INSERT INTO exams (name, description) VALUES ('試験A', '説明A');
      INSERT INTO exams (name, description) VALUES ('試験B', NULL);
    `);
    const res = await app.request('/api/exams');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('試験A');
    expect(body[0].description).toBe('説明A');
    expect(body[0].totalSessions).toBe(0);
    expect(body[0].overallCorrectRate).toBeNull();
    expect(body[1].name).toBe('試験B');
    expect(body[1].description).toBeNull();
  });
});

describe('GET /api/exams/:examId', () => {
  it('存在する試験IDで詳細を返す', async () => {
    const result = db.prepare("INSERT INTO exams (name, description) VALUES (?, ?)").run('AWS CP', '解説');
    const id = result.lastInsertRowid;
    const res = await app.request(`/api/exams/${id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('AWS CP');
    expect(body.description).toBe('解説');
  });

  it('存在しない試験IDで404を返す', async () => {
    const res = await app.request('/api/exams/9999');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('試験が見つかりません');
  });

  it('数値でないIDで404を返す', async () => {
    const res = await app.request('/api/exams/abc');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/exams', () => {
  it('正常なリクエストで試験を作成し201を返す', async () => {
    const res = await app.request('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '新しい試験', description: '説明文' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('新しい試験');
    expect(body.description).toBe('説明文');
    expect(body.id).toBeDefined();
  });

  it('descriptionを省略してもを作成できる', async () => {
    const res = await app.request('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '説明なし試験' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.description).toBeNull();
  });

  it('nameが空文字のとき400を返す', async () => {
    const res = await app.request('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('名前は必須です');
  });

  it('nameが未指定のとき400を返す', async () => {
    const res = await app.request('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: '名前なし' }),
    });
    expect(res.status).toBe(400);
  });

  it('重複した名前のとき409を返す', async () => {
    db.prepare("INSERT INTO exams (name) VALUES (?)").run('重複試験');
    const res = await app.request('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '重複試験' }),
    });
    expect(res.status).toBe(409);
  });

  it('SQLインジェクションを含む名前でも安全に登録できる', async () => {
    const malicious = "test'); DROP TABLE exams; --";
    const res = await app.request('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: malicious }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe(malicious);
    // テーブルが残っていることを確認
    const count = db.prepare('SELECT COUNT(*) as n FROM exams').get() as { n: number };
    expect(count.n).toBeGreaterThan(0);
  });
});

describe('PUT /api/exams/:examId', () => {
  it('存在する試験を更新できる', async () => {
    const result = db.prepare("INSERT INTO exams (name) VALUES ('旧名前')").run();
    const id = result.lastInsertRowid;
    const res = await app.request(`/api/exams/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '新名前', description: '新説明' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('新名前');
    expect(body.description).toBe('新説明');
  });

  it('存在しない試験IDで404を返す', async () => {
    const res = await app.request('/api/exams/9999', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '更新名' }),
    });
    expect(res.status).toBe(404);
  });

  it('nameが空のとき400を返す', async () => {
    const result = db.prepare("INSERT INTO exams (name) VALUES ('既存')").run();
    const id = result.lastInsertRowid;
    const res = await app.request(`/api/exams/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/exams/:examId', () => {
  it('存在する試験を削除し204を返す', async () => {
    const result = db.prepare("INSERT INTO exams (name) VALUES ('削除対象')").run();
    const id = result.lastInsertRowid;
    const res = await app.request(`/api/exams/${id}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    const check = db.prepare('SELECT id FROM exams WHERE id = ?').get(id);
    expect(check).toBeUndefined();
  });

  it('存在しない試験IDで404を返す', async () => {
    const res = await app.request('/api/exams/9999', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
