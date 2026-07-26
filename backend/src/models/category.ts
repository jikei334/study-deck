import db from '../db/client.js';

export interface CategoryRow {
  id: number;
  examId: number;
  name: string;
  sortOrder: number;
  questionCount: number;
  correctRate: number | null;
}

export function findCategoriesByExamId(examId: number): CategoryRow[] {
  return db.prepare<[number], CategoryRow>(`
    SELECT
      c.id,
      c.exam_id          AS examId,
      c.name,
      c.sort_order       AS sortOrder,
      COUNT(DISTINCT q.id) AS questionCount,
      CASE
        WHEN COUNT(qa.id) = 0 THEN NULL
        ELSE ROUND(AVG(CAST(qa.is_correct AS REAL)), 4)
      END AS correctRate
    FROM categories c
    LEFT JOIN questions q  ON q.category_id = c.id
    LEFT JOIN quiz_answers qa ON qa.question_id = q.id
    WHERE c.exam_id = ?
    GROUP BY c.id
    ORDER BY c.sort_order ASC
  `).all(examId);
}

export function findCategoryById(id: number): CategoryRow | undefined {
  return db.prepare<[number], CategoryRow>(`
    SELECT
      c.id,
      c.exam_id          AS examId,
      c.name,
      c.sort_order       AS sortOrder,
      COUNT(DISTINCT q.id) AS questionCount,
      CASE
        WHEN COUNT(qa.id) = 0 THEN NULL
        ELSE ROUND(AVG(CAST(qa.is_correct AS REAL)), 4)
      END AS correctRate
    FROM categories c
    LEFT JOIN questions q  ON q.category_id = c.id
    LEFT JOIN quiz_answers qa ON qa.question_id = q.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(id);
}
