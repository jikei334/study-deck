import db from '../db/client.js';

export interface ChoiceRow {
  id: number;
  questionId: number;
  text: string;
  isCorrect: boolean;
  explanation: string | null;
  sortOrder: number;
}

export interface QuestionRow {
  id: number;
  categoryId: number;
  text: string;
  explanation: string | null;
  choices: ChoiceRow[];
}

export interface ChoiceInput {
  text: string;
  isCorrect: boolean;
  explanation?: string | null;
  sortOrder: number;
}

function loadChoicesForQuestions(questionIds: number[]): Map<number, ChoiceRow[]> {
  if (questionIds.length === 0) return new Map();
  const ph = questionIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT id, question_id AS questionId, text, is_correct AS isCorrect, explanation, sort_order AS sortOrder
     FROM choices WHERE question_id IN (${ph}) ORDER BY sort_order`
  ).all(...questionIds) as (Omit<ChoiceRow, 'isCorrect'> & { isCorrect: number })[];

  const map = new Map<number, ChoiceRow[]>();
  for (const r of rows) {
    if (!map.has(r.questionId)) map.set(r.questionId, []);
    map.get(r.questionId)!.push({ ...r, isCorrect: r.isCorrect === 1 });
  }
  return map;
}

export function findQuestionsByCategory(categoryId: number): QuestionRow[] {
  const questions = db.prepare(
    'SELECT id, category_id AS categoryId, text, explanation FROM questions WHERE category_id = ? ORDER BY id'
  ).all(categoryId) as Omit<QuestionRow, 'choices'>[];

  const choiceMap = loadChoicesForQuestions(questions.map(q => q.id));
  return questions.map(q => ({ ...q, choices: choiceMap.get(q.id) ?? [] }));
}

export function findQuestionById(id: number): QuestionRow | undefined {
  const q = db.prepare(
    'SELECT id, category_id AS categoryId, text, explanation FROM questions WHERE id = ?'
  ).get(id) as Omit<QuestionRow, 'choices'> | undefined;
  if (!q) return undefined;
  const choiceMap = loadChoicesForQuestions([q.id]);
  return { ...q, choices: choiceMap.get(q.id) ?? [] };
}

function insertChoices(questionId: number, choices: ChoiceInput[]): void {
  const stmt = db.prepare(
    'INSERT INTO choices (question_id, text, is_correct, explanation, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  for (const c of choices) {
    stmt.run(questionId, c.text, c.isCorrect ? 1 : 0, c.explanation ?? null, c.sortOrder);
  }
}

export function createQuestion(categoryId: number, text: string, explanation: string | null, choices: ChoiceInput[]): QuestionRow {
  const res = db.prepare(
    'INSERT INTO questions (category_id, text, explanation) VALUES (?, ?, ?)'
  ).run(categoryId, text, explanation ?? null);
  const questionId = res.lastInsertRowid as number;
  insertChoices(questionId, choices);
  return findQuestionById(questionId)!;
}

export function updateQuestion(id: number, text: string, explanation: string | null, choices: ChoiceInput[]): QuestionRow | undefined {
  const result = db.prepare(
    'UPDATE questions SET text = ?, explanation = ? WHERE id = ?'
  ).run(text, explanation ?? null, id);
  if (result.changes === 0) return undefined;

  db.prepare('DELETE FROM choices WHERE question_id = ?').run(id);
  insertChoices(id, choices);
  return findQuestionById(id);
}

export function deleteQuestion(id: number): boolean {
  return db.prepare('DELETE FROM questions WHERE id = ?').run(id).changes > 0;
}
