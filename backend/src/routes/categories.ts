import { Hono } from 'hono';
import { findExamById } from '../models/exam.js';
import {
  findCategoriesByExamId,
  findCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../models/category.js';

const categories = new Hono();

function formatCategory(r: ReturnType<typeof findCategoryById>) {
  if (!r) return null;
  return { id: r.id, examId: r.examId, name: r.name, sortOrder: r.sortOrder, questionCount: r.questionCount, correctRate: r.correctRate };
}

// GET /api/exams/:examId/categories
categories.get('/', (c) => {
  const examId = Number(c.req.param('examId'));
  if (isNaN(examId)) return c.json({ error: '試験が見つかりません' }, 404);

  const exam = findExamById(examId);
  if (!exam) return c.json({ error: '試験が見つかりません' }, 404);

  return c.json(findCategoriesByExamId(examId).map(formatCategory));
});

// POST /api/exams/:examId/categories
categories.post('/', async (c) => {
  const examId = Number(c.req.param('examId'));
  if (isNaN(examId)) return c.json({ error: '試験が見つかりません' }, 404);

  const exam = findExamById(examId);
  if (!exam) return c.json({ error: '試験が見つかりません' }, 404);

  let body: { name?: unknown; sortOrder?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'リクエストボディが不正です' }, 400); }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return c.json({ error: 'カテゴリ名は必須です' }, 400);

  const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : 0;
  return c.json(formatCategory(createCategory(examId, name, sortOrder)), 201);
});

// PUT /api/categories/:categoryId
categories.put('/:categoryId', async (c) => {
  const categoryId = Number(c.req.param('categoryId'));
  if (isNaN(categoryId)) return c.json({ error: 'カテゴリが見つかりません' }, 404);

  let body: { name?: unknown; sortOrder?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'リクエストボディが不正です' }, 400); }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return c.json({ error: 'カテゴリ名は必須です' }, 400);

  const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : 0;
  const updated = updateCategory(categoryId, name, sortOrder);
  if (!updated) return c.json({ error: 'カテゴリが見つかりません' }, 404);
  return c.json(formatCategory(updated));
});

// DELETE /api/categories/:categoryId
categories.delete('/:categoryId', (c) => {
  const categoryId = Number(c.req.param('categoryId'));
  if (isNaN(categoryId)) return c.json({ error: 'カテゴリが見つかりません' }, 404);

  if (!deleteCategory(categoryId)) return c.json({ error: 'カテゴリが見つかりません' }, 404);
  return c.body(null, 204);
});

export default categories;
