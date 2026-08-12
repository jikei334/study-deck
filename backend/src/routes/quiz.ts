import { Hono } from 'hono';
import { findExamById } from '../models/exam.js';
import {
  createSession,
  findSessionById,
  recordAnswer,
  completeSession,
  getSessionResult,
} from '../models/quizSession.js';

const quiz = new Hono();

// POST /api/quiz/sessions
quiz.post('/sessions', async (c) => {
  let body: { examId?: unknown; mode?: unknown; categoryId?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'リクエストボディが不正です' }, 400);
  }

  const examId = Number(body.examId);
  const mode = String(body.mode ?? '');
  const categoryId = body.categoryId != null ? Number(body.categoryId) : undefined;

  if (!body.examId || !body.mode) return c.json({ error: '試験IDとモードは必須です' }, 400);
  if (!['category', 'random', 'weak'].includes(mode)) return c.json({ error: '無効なモードです' }, 400);
  if (mode === 'category' && !categoryId) return c.json({ error: 'カテゴリモードにはcategoryIdが必要です' }, 400);
  if (isNaN(examId)) return c.json({ error: '試験が見つかりません' }, 404);

  const exam = findExamById(examId);
  if (!exam) return c.json({ error: '試験が見つかりません' }, 404);

  try {
    const session = createSession(examId, mode as 'category' | 'random' | 'weak', categoryId);
    return c.json(session, 201);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});

// GET /api/quiz/sessions/:sessionId
quiz.get('/sessions/:sessionId', (c) => {
  const sessionId = Number(c.req.param('sessionId'));
  if (isNaN(sessionId)) return c.json({ error: 'セッションが見つかりません' }, 404);

  const session = findSessionById(sessionId);
  if (!session) return c.json({ error: 'セッションが見つかりません' }, 404);

  return c.json(session);
});

// POST /api/quiz/sessions/:sessionId/answers
quiz.post('/sessions/:sessionId/answers', async (c) => {
  const sessionId = Number(c.req.param('sessionId'));
  if (isNaN(sessionId)) return c.json({ error: 'セッションが見つかりません' }, 404);

  const session = findSessionById(sessionId);
  if (!session) return c.json({ error: 'セッションが見つかりません' }, 404);
  if (session.completedAt) return c.json({ error: 'このセッションは完了しています' }, 409);

  let body: { questionId?: unknown; selectedChoiceId?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'リクエストボディが不正です' }, 400);
  }

  const questionId = Number(body.questionId);
  const selectedChoiceId = Number(body.selectedChoiceId);
  if (!body.questionId || !body.selectedChoiceId) return c.json({ error: '問題IDと選択肢IDは必須です' }, 400);
  if (isNaN(questionId) || isNaN(selectedChoiceId)) return c.json({ error: '問題IDと選択肢IDは数値でなければなりません' }, 400);

  try {
    const result = recordAnswer(sessionId, questionId, selectedChoiceId);
    return c.json(result, 201);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('UNIQUE')) return c.json({ error: 'この問題はすでに回答済みです' }, 409);
    if (msg.includes('選択肢が見つかりません')) return c.json({ error: msg }, 404);
    throw e;
  }
});

// PATCH /api/quiz/sessions/:sessionId/complete
quiz.patch('/sessions/:sessionId/complete', (c) => {
  const sessionId = Number(c.req.param('sessionId'));
  if (isNaN(sessionId)) return c.json({ error: 'セッションが見つかりません' }, 404);

  const ok = completeSession(sessionId);
  if (!ok) return c.json({ error: 'セッションが見つかりません' }, 404);

  return c.json({ ok: true });
});

// GET /api/quiz/sessions/:sessionId/result
quiz.get('/sessions/:sessionId/result', (c) => {
  const sessionId = Number(c.req.param('sessionId'));
  if (isNaN(sessionId)) return c.json({ error: 'セッションが見つかりません' }, 404);

  const result = getSessionResult(sessionId);
  if (!result) return c.json({ error: 'セッションが見つかりません、または未完了です' }, 404);

  return c.json(result);
});

export default quiz;
