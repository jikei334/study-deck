import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Choice {
  text: string;
  isCorrect: boolean;
  explanation: string;
  sortOrder: number;
}

interface Question {
  text: string;
  explanation: string | null;
  choices: Choice[];
}

interface Term {
  name: string;
  description: string;
}

interface CategoryData {
  name: string;
  sortOrder: number;
  questions: Question[];
  terms: Term[];
}

interface SeedData {
  exam: { name: string; description: string };
  categories: CategoryData[];
}

export function seed(seedFile = 'aws-cp.json'): void {
  const filePath = path.join(__dirname, '../../seeds', seedFile);
  const data: SeedData = JSON.parse(readFileSync(filePath, 'utf-8'));

  const existing = db
    .prepare('SELECT id FROM exams WHERE name = ?')
    .get(data.exam.name);
  if (existing) {
    console.log(`シードデータ「${data.exam.name}」は既に存在します。スキップします。`);
    return;
  }

  const examResult = db
    .prepare('INSERT INTO exams (name, description) VALUES (?, ?)')
    .run(data.exam.name, data.exam.description);
  const examId = examResult.lastInsertRowid as number;

  for (const cat of data.categories) {
    const catResult = db
      .prepare('INSERT INTO categories (exam_id, name, sort_order) VALUES (?, ?, ?)')
      .run(examId, cat.name, cat.sortOrder);
    const categoryId = catResult.lastInsertRowid as number;

    for (const q of cat.questions) {
      const qResult = db
        .prepare('INSERT INTO questions (category_id, text, explanation) VALUES (?, ?, ?)')
        .run(categoryId, q.text, q.explanation ?? null);
      const questionId = qResult.lastInsertRowid as number;

      for (const c of q.choices) {
        db.prepare(
          'INSERT INTO choices (question_id, text, is_correct, explanation, sort_order) VALUES (?, ?, ?, ?, ?)'
        ).run(questionId, c.text, c.isCorrect ? 1 : 0, c.explanation, c.sortOrder);
      }
    }

    for (const t of cat.terms) {
      db.prepare(
        'INSERT INTO terms (category_id, name, description) VALUES (?, ?, ?)'
      ).run(categoryId, t.name, t.description);
    }
  }

  console.log(`シード完了: 「${data.exam.name}」、${data.categories.length}カテゴリを投入しました。`);
}
