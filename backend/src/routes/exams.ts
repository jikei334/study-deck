import { Hono } from 'hono';
import {
  findAllExams,
  findExamById,
  createExam,
  updateExam,
  deleteExam,
} from '../models/exam.js';

const exams = new Hono();

// 試験一覧取得
exams.get('/', (c) => {
  const rows = findAllExams();
  return c.json(rows.map(formatExam));
});

// 試験詳細取得
exams.get('/:examId', (c) => {
  const id = Number(c.req.param('examId'));
  if (isNaN(id)) return c.json({ error: '試験が見つかりません' }, 404);

  const exam = findExamById(id);
  if (!exam) return c.json({ error: '試験が見つかりません' }, 404);

  return c.json(formatExam(exam));
});

// 試験作成
exams.post('/', async (c) => {
  const body = await c.req.json<{ name?: string; description?: string }>();
  const name = body.name?.trim();
  if (!name) return c.json({ error: '名前は必須です' }, 400);

  try {
    const exam = createExam(name, body.description);
    return c.json(formatExam(exam), 201);
  } catch (err: unknown) {
    // UNIQUE制約違反
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return c.json({ error: 'その試験名はすでに使われています' }, 409);
    }
    throw err;
  }
});

// 試験更新
exams.put('/:examId', async (c) => {
  const id = Number(c.req.param('examId'));
  if (isNaN(id)) return c.json({ error: '試験が見つかりません' }, 404);

  const body = await c.req.json<{ name?: string; description?: string }>();
  const name = body.name?.trim();
  if (!name) return c.json({ error: '名前は必須です' }, 400);

  const existing = findExamById(id);
  if (!existing) return c.json({ error: '試験が見つかりません' }, 404);

  try {
    const exam = updateExam(id, name, body.description);
    return c.json(formatExam(exam!));
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return c.json({ error: 'その試験名はすでに使われています' }, 409);
    }
    throw err;
  }
});

// 試験削除
exams.delete('/:examId', (c) => {
  const id = Number(c.req.param('examId'));
  if (isNaN(id)) return c.json({ error: '試験が見つかりません' }, 404);

  const deleted = deleteExam(id);
  if (!deleted) return c.json({ error: '試験が見つかりません' }, 404);

  return c.body(null, 204);
});

function formatExam(row: ReturnType<typeof findExamById> & object) {
  return {
    id: row!.id,
    name: row!.name,
    description: row!.description,
    createdAt: row!.created_at,
    totalSessions: row!.totalSessions,
    overallCorrectRate: row!.overallCorrectRate,
  };
}

export default exams;
