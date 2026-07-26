import db from '../db/client.js';

export interface ExamRow {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  totalSessions: number;
  overallCorrectRate: number | null;
}

export function findAllExams(): ExamRow[] {
  return db.prepare<[], ExamRow>(`
    SELECT
      e.id,
      e.name,
      e.description,
      e.created_at,
      COUNT(DISTINCT CASE WHEN qs.completed_at IS NOT NULL THEN qs.id END) AS totalSessions,
      CASE
        WHEN COUNT(qa.id) = 0 THEN NULL
        ELSE ROUND(AVG(CAST(qa.is_correct AS REAL)), 4)
      END AS overallCorrectRate
    FROM exams e
    LEFT JOIN quiz_sessions qs ON qs.exam_id = e.id
    LEFT JOIN quiz_answers qa ON qa.session_id = qs.id
    GROUP BY e.id
    ORDER BY e.created_at ASC
  `).all();
}

export function findExamById(id: number): ExamRow | undefined {
  return db.prepare<[number], ExamRow>(`
    SELECT
      e.id,
      e.name,
      e.description,
      e.created_at,
      COUNT(DISTINCT CASE WHEN qs.completed_at IS NOT NULL THEN qs.id END) AS totalSessions,
      CASE
        WHEN COUNT(qa.id) = 0 THEN NULL
        ELSE ROUND(AVG(CAST(qa.is_correct AS REAL)), 4)
      END AS overallCorrectRate
    FROM exams e
    LEFT JOIN quiz_sessions qs ON qs.exam_id = e.id
    LEFT JOIN quiz_answers qa ON qa.session_id = qs.id
    WHERE e.id = ?
    GROUP BY e.id
  `).get(id);
}

export function createExam(name: string, description?: string): ExamRow {
  const result = db.prepare<[string, string | null]>(
    'INSERT INTO exams (name, description) VALUES (?, ?)'
  ).run(name, description ?? null);

  return findExamById(result.lastInsertRowid as number)!;
}

export function updateExam(id: number, name: string, description?: string): ExamRow | undefined {
  db.prepare<[string, string | null, number]>(
    'UPDATE exams SET name = ?, description = ? WHERE id = ?'
  ).run(name, description ?? null, id);

  return findExamById(id);
}

export function deleteExam(id: number): boolean {
  const result = db.prepare<[number]>('DELETE FROM exams WHERE id = ?').run(id);
  return result.changes > 0;
}
