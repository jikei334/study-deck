import { Hono } from 'hono';
import { findExamById } from '../models/exam.js';
import { findCategoriesByExamId } from '../models/category.js';

const categories = new Hono<{ Variables: { examId: number } }>();

// GET /api/exams/:examId/categories
categories.get('/', (c) => {
  const examId = Number(c.req.param('examId'));
  if (isNaN(examId)) return c.json({ error: '試験が見つかりません' }, 404);

  const exam = findExamById(examId);
  if (!exam) return c.json({ error: '試験が見つかりません' }, 404);

  const rows = findCategoriesByExamId(examId);
  return c.json(rows.map((r) => ({
    id: r.id,
    examId: r.examId,
    name: r.name,
    sortOrder: r.sortOrder,
    questionCount: r.questionCount,
    correctRate: r.correctRate,
  })));
});

export default categories;
