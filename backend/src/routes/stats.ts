import { Hono } from 'hono';
import { findExamById } from '../models/exam.js';
import { findExamStats } from '../models/stats.js';

const stats = new Hono();

// GET /api/exams/:examId/stats
stats.get('/', (c) => {
  const examId = Number(c.req.param('examId'));
  if (isNaN(examId)) return c.json({ error: '試験が見つかりません' }, 404);

  const exam = findExamById(examId);
  if (!exam) return c.json({ error: '試験が見つかりません' }, 404);

  return c.json(findExamStats(examId));
});

export default stats;
