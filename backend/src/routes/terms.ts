import { Hono } from 'hono';
import { findExamById } from '../models/exam.js';
import { findCategoryById } from '../models/category.js';
import { findTermsByExamId, findTermById, createTerm, updateTerm, deleteTerm } from '../models/term.js';

const terms = new Hono();

// GET /api/exams/:examId/terms?q=...&categoryId=...
terms.get('/', (c) => {
  const examId = Number(c.req.param('examId'));
  if (isNaN(examId)) return c.json({ error: '試験が見つかりません' }, 404);

  const exam = findExamById(examId);
  if (!exam) return c.json({ error: '試験が見つかりません' }, 404);

  const q = c.req.query('q');
  const categoryIdParam = c.req.query('categoryId');
  const categoryId = categoryIdParam ? Number(categoryIdParam) : undefined;

  const rows = findTermsByExamId(examId, q, categoryId);
  return c.json(rows);
});

// POST /api/terms
terms.post('/', async (c) => {
  let body: { categoryId?: unknown; name?: unknown; description?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'リクエストボディが不正です' }, 400);
  }

  const categoryId = Number(body.categoryId);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!body.categoryId) return c.json({ error: 'categoryIdは必須です' }, 400);
  if (isNaN(categoryId)) return c.json({ error: 'categoryIdは数値でなければなりません' }, 400);
  if (!name) return c.json({ error: '用語名は必須です' }, 400);
  if (!description) return c.json({ error: '説明は必須です' }, 400);

  const category = findCategoryById(categoryId);
  if (!category) return c.json({ error: 'カテゴリが見つかりません' }, 404);

  const term = createTerm(categoryId, name, description);
  return c.json(term, 201);
});

// PUT /api/terms/:termId
terms.put('/:termId', async (c) => {
  const termId = Number(c.req.param('termId'));
  if (isNaN(termId)) return c.json({ error: '用語が見つかりません' }, 404);

  let body: { name?: unknown; description?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'リクエストボディが不正です' }, 400);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!name) return c.json({ error: '用語名は必須です' }, 400);
  if (!description) return c.json({ error: '説明は必須です' }, 400);

  const term = updateTerm(termId, name, description);
  if (!term) return c.json({ error: '用語が見つかりません' }, 404);

  return c.json(term);
});

// DELETE /api/terms/:termId
terms.delete('/:termId', (c) => {
  const termId = Number(c.req.param('termId'));
  if (isNaN(termId)) return c.json({ error: '用語が見つかりません' }, 404);

  const ok = deleteTerm(termId);
  if (!ok) return c.json({ error: '用語が見つかりません' }, 404);

  return c.body(null, 204);
});

export default terms;
