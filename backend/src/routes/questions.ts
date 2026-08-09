import { Hono } from 'hono';
import { findCategoryById } from '../models/category.js';
import {
  findQuestionsByCategory,
  findQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  type ChoiceInput,
} from '../models/question.js';

const questions = new Hono();

type ChoiceBody = { text?: unknown; isCorrect?: unknown; explanation?: unknown; sortOrder?: unknown };

function validateChoices(choices: unknown): { ok: true; data: ChoiceInput[] } | { ok: false; error: string } {
  if (!Array.isArray(choices)) return { ok: false, error: '選択肢は配列でなければなりません' };
  if (choices.length !== 4) return { ok: false, error: '選択肢は4つでなければなりません' };

  const parsed: ChoiceInput[] = [];
  for (let i = 0; i < choices.length; i++) {
    const c = choices[i] as ChoiceBody;
    const text = typeof c.text === 'string' ? c.text.trim() : '';
    if (!text) return { ok: false, error: `選択肢${i + 1}のtextは必須です` };
    parsed.push({
      text,
      isCorrect: Boolean(c.isCorrect),
      explanation: typeof c.explanation === 'string' ? c.explanation : null,
      sortOrder: typeof c.sortOrder === 'number' ? c.sortOrder : i + 1,
    });
  }

  const correctCount = parsed.filter(c => c.isCorrect).length;
  if (correctCount !== 1) return { ok: false, error: '正解は1つでなければなりません' };

  return { ok: true, data: parsed };
}

// GET /api/categories/:categoryId/questions
questions.get('/', (c) => {
  const categoryId = Number(c.req.param('categoryId'));
  if (isNaN(categoryId)) return c.json({ error: 'カテゴリが見つかりません' }, 404);

  const category = findCategoryById(categoryId);
  if (!category) return c.json({ error: 'カテゴリが見つかりません' }, 404);

  return c.json(findQuestionsByCategory(categoryId));
});

// POST /api/questions
questions.post('/', async (c) => {
  let body: { categoryId?: unknown; text?: unknown; explanation?: unknown; choices?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'リクエストボディが不正です' }, 400); }

  const categoryId = Number(body.categoryId);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const explanation = typeof body.explanation === 'string' ? body.explanation.trim() || null : null;

  if (!body.categoryId) return c.json({ error: 'categoryIdは必須です' }, 400);
  if (isNaN(categoryId)) return c.json({ error: 'categoryIdは数値でなければなりません' }, 400);
  if (!text) return c.json({ error: '問題文は必須です' }, 400);

  const category = findCategoryById(categoryId);
  if (!category) return c.json({ error: 'カテゴリが見つかりません' }, 404);

  const choiceResult = validateChoices(body.choices);
  if (!choiceResult.ok) return c.json({ error: choiceResult.error }, 400);

  const question = createQuestion(categoryId, text, explanation, choiceResult.data);
  return c.json(question, 201);
});

// PUT /api/questions/:questionId
questions.put('/:questionId', async (c) => {
  const questionId = Number(c.req.param('questionId'));
  if (isNaN(questionId)) return c.json({ error: '問題が見つかりません' }, 404);

  let body: { text?: unknown; explanation?: unknown; choices?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'リクエストボディが不正です' }, 400); }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const explanation = typeof body.explanation === 'string' ? body.explanation.trim() || null : null;

  if (!text) return c.json({ error: '問題文は必須です' }, 400);

  const choiceResult = validateChoices(body.choices);
  if (!choiceResult.ok) return c.json({ error: choiceResult.error }, 400);

  const question = updateQuestion(questionId, text, explanation, choiceResult.data);
  if (!question) return c.json({ error: '問題が見つかりません' }, 404);

  return c.json(question);
});

// DELETE /api/questions/:questionId
questions.delete('/:questionId', (c) => {
  const questionId = Number(c.req.param('questionId'));
  if (isNaN(questionId)) return c.json({ error: '問題が見つかりません' }, 404);

  if (!deleteQuestion(questionId)) return c.json({ error: '問題が見つかりません' }, 404);
  return c.body(null, 204);
});

export default questions;
