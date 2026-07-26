import db from '../db/client.js';

type QuizMode = 'category' | 'random' | 'weak';

export interface ChoiceForSession {
  id: number;
  text: string;
  sortOrder: number;
}

export interface QuestionForSession {
  id: number;
  text: string;
  choices: ChoiceForSession[];
}

export interface SessionForClient {
  id: number;
  examId: number;
  mode: QuizMode;
  categoryId: number | null;
  startedAt: string;
  completedAt: string | null;
  questions: QuestionForSession[];
}

export interface AnswerResult {
  isCorrect: boolean;
  correctChoiceId: number;
  choices: { id: number; text: string; isCorrect: boolean; explanation: string | null }[];
  questionExplanation: string | null;
}

export interface SessionResultAnswer {
  questionId: number;
  questionText: string;
  selectedChoiceId: number;
  selectedChoiceText: string;
  correctChoiceId: number;
  correctChoiceText: string;
  isCorrect: boolean;
}

export interface SessionResult {
  id: number;
  examId: number;
  mode: QuizMode;
  startedAt: string;
  completedAt: string;
  totalCount: number;
  correctCount: number;
  correctRate: number;
  categoryStats: { categoryId: number; categoryName: string; total: number; correct: number; correctRate: number }[];
  answers: SessionResultAnswer[];
}

function selectQuestionIds(examId: number, mode: QuizMode, categoryId?: number): number[] {
  if (mode === 'category') {
    return (db.prepare('SELECT id FROM questions WHERE category_id = ? ORDER BY id').all(categoryId!) as { id: number }[])
      .map(r => r.id);
  }

  if (mode === 'random') {
    return (db.prepare(
      'SELECT q.id FROM questions q JOIN categories c ON c.id = q.category_id WHERE c.exam_id = ? ORDER BY RANDOM()'
    ).all(examId) as { id: number }[]).map(r => r.id);
  }

  // weak モード: 正答率の低い問題を優先、未回答問題はNULL → SQLiteのASC NULLSにより末尾
  return (db.prepare(`
    SELECT q.id
    FROM questions q
    JOIN categories c ON c.id = q.category_id
    LEFT JOIN quiz_answers qa ON qa.question_id = q.id
    WHERE c.exam_id = ?
    GROUP BY q.id
    ORDER BY AVG(CAST(qa.is_correct AS REAL)) ASC
  `).all(examId) as { id: number }[]).map(r => r.id);
}

function loadQuestions(questionIds: number[]): QuestionForSession[] {
  if (questionIds.length === 0) return [];
  const ph = questionIds.map(() => '?').join(',');

  const questions = db.prepare(
    `SELECT id, text FROM questions WHERE id IN (${ph})`
  ).all(...questionIds) as { id: number; text: string }[];

  const choices = db.prepare(
    `SELECT id, question_id AS questionId, text, sort_order AS sortOrder
     FROM choices WHERE question_id IN (${ph}) ORDER BY sort_order`
  ).all(...questionIds) as { id: number; questionId: number; text: string; sortOrder: number }[];

  const choiceMap = new Map<number, ChoiceForSession[]>();
  for (const c of choices) {
    if (!choiceMap.has(c.questionId)) choiceMap.set(c.questionId, []);
    choiceMap.get(c.questionId)!.push({ id: c.id, text: c.text, sortOrder: c.sortOrder });
  }

  const questionMap = new Map(questions.map(q => [q.id, q]));
  return questionIds
    .map(id => {
      const q = questionMap.get(id);
      return q ? { id: q.id, text: q.text, choices: choiceMap.get(q.id) ?? [] } : null;
    })
    .filter((q): q is QuestionForSession => q !== null);
}

export function createSession(examId: number, mode: QuizMode, categoryId?: number): SessionForClient {
  const questionIds = selectQuestionIds(examId, mode, categoryId);
  if (questionIds.length === 0) throw new Error('出題できる問題がありません');

  const ins = db.prepare(
    'INSERT INTO quiz_sessions (exam_id, mode, category_id, question_ids) VALUES (?, ?, ?, ?)'
  ).run(examId, mode, categoryId ?? null, JSON.stringify(questionIds));

  const row = db.prepare(
    'SELECT id, exam_id AS examId, mode, category_id AS categoryId, started_at AS startedAt, completed_at AS completedAt FROM quiz_sessions WHERE id = ?'
  ).get(ins.lastInsertRowid as number) as { id: number; examId: number; mode: string; categoryId: number | null; startedAt: string; completedAt: string | null };

  return { ...row, mode: row.mode as QuizMode, questions: loadQuestions(questionIds) };
}

export function findSessionById(id: number): SessionForClient | undefined {
  const row = db.prepare(
    'SELECT id, exam_id AS examId, mode, category_id AS categoryId, question_ids AS questionIds, started_at AS startedAt, completed_at AS completedAt FROM quiz_sessions WHERE id = ?'
  ).get(id) as { id: number; examId: number; mode: string; categoryId: number | null; questionIds: string; startedAt: string; completedAt: string | null } | undefined;

  if (!row) return undefined;
  const questionIds: number[] = JSON.parse(row.questionIds);
  return {
    id: row.id,
    examId: row.examId,
    mode: row.mode as QuizMode,
    categoryId: row.categoryId,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    questions: loadQuestions(questionIds),
  };
}

export function recordAnswer(sessionId: number, questionId: number, selectedChoiceId: number): AnswerResult {
  const choice = db.prepare('SELECT is_correct AS isCorrect FROM choices WHERE id = ?').get(selectedChoiceId) as { isCorrect: number } | undefined;
  if (!choice) throw new Error('選択肢が見つかりません');

  const isCorrect = choice.isCorrect === 1;

  db.prepare(
    'INSERT INTO quiz_answers (session_id, question_id, selected_choice_id, is_correct) VALUES (?, ?, ?, ?)'
  ).run(sessionId, questionId, selectedChoiceId, isCorrect ? 1 : 0);

  const choices = db.prepare(
    'SELECT id, text, is_correct AS isCorrect, explanation FROM choices WHERE question_id = ? ORDER BY sort_order'
  ).all(questionId) as { id: number; text: string; isCorrect: number; explanation: string | null }[];

  const correctChoiceId = choices.find(c => c.isCorrect === 1)?.id ?? 0;

  const question = db.prepare('SELECT explanation FROM questions WHERE id = ?').get(questionId) as { explanation: string | null } | undefined;

  return {
    isCorrect,
    correctChoiceId,
    choices: choices.map(c => ({ id: c.id, text: c.text, isCorrect: c.isCorrect === 1, explanation: c.explanation })),
    questionExplanation: question?.explanation ?? null,
  };
}

export function completeSession(id: number): boolean {
  const exists = db.prepare('SELECT id FROM quiz_sessions WHERE id = ?').get(id);
  if (!exists) return false;
  db.prepare(
    "UPDATE quiz_sessions SET completed_at = COALESCE(completed_at, datetime('now')) WHERE id = ?"
  ).run(id);
  return true;
}

export function getSessionResult(id: number): SessionResult | undefined {
  const row = db.prepare(
    'SELECT id, exam_id AS examId, mode, started_at AS startedAt, completed_at AS completedAt FROM quiz_sessions WHERE id = ?'
  ).get(id) as { id: number; examId: number; mode: string; startedAt: string; completedAt: string | null } | undefined;

  if (!row || !row.completedAt) return undefined;

  const rawAnswers = db.prepare(`
    SELECT
      qa.question_id        AS questionId,
      q.text                AS questionText,
      qa.selected_choice_id AS selectedChoiceId,
      sc.text               AS selectedChoiceText,
      cc.id                 AS correctChoiceId,
      cc.text               AS correctChoiceText,
      qa.is_correct         AS isCorrect
    FROM quiz_answers qa
    JOIN questions q ON q.id = qa.question_id
    JOIN choices sc  ON sc.id = qa.selected_choice_id
    JOIN choices cc  ON cc.question_id = qa.question_id AND cc.is_correct = 1
    WHERE qa.session_id = ?
  `).all(id) as (SessionResultAnswer & { isCorrect: number })[];

  const categoryStats = db.prepare(`
    SELECT
      c.id   AS categoryId,
      c.name AS categoryName,
      COUNT(qa.id)                               AS total,
      SUM(qa.is_correct)                         AS correct,
      ROUND(AVG(CAST(qa.is_correct AS REAL)), 4) AS correctRate
    FROM quiz_answers qa
    JOIN questions q ON q.id = qa.question_id
    JOIN categories c ON c.id = q.category_id
    WHERE qa.session_id = ?
    GROUP BY c.id
  `).all(id) as { categoryId: number; categoryName: string; total: number; correct: number; correctRate: number }[];

  const totalCount = rawAnswers.length;
  const correctCount = rawAnswers.filter(a => a.isCorrect === 1).length;

  return {
    id: row.id,
    examId: row.examId,
    mode: row.mode as QuizMode,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    totalCount,
    correctCount,
    correctRate: totalCount > 0 ? correctCount / totalCount : 0,
    categoryStats,
    answers: rawAnswers.map(a => ({ ...a, isCorrect: a.isCorrect === 1 })),
  };
}
