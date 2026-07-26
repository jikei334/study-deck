import db from '../db/client.js';

export interface CategoryStat {
  categoryId: number;
  categoryName: string;
  totalAnswered: number;
  correctCount: number;
  correctRate: number;
}

export interface RecentSession {
  id: number;
  mode: string;
  correctCount: number;
  totalCount: number;
  correctRate: number;
  completedAt: string;
}

export interface ExamStats {
  categoryStats: CategoryStat[];
  recentSessions: RecentSession[];
}

export function findExamStats(examId: number): ExamStats {
  const categoryStats = db.prepare<[number], CategoryStat>(`
    SELECT
      c.id                         AS categoryId,
      c.name                       AS categoryName,
      COUNT(qa.id)                 AS totalAnswered,
      SUM(qa.is_correct)           AS correctCount,
      ROUND(AVG(CAST(qa.is_correct AS REAL)), 4) AS correctRate
    FROM categories c
    JOIN questions q   ON q.category_id = c.id
    JOIN quiz_answers qa ON qa.question_id = q.id
    WHERE c.exam_id = ?
    GROUP BY c.id
    ORDER BY c.sort_order ASC
  `).all(examId);

  const recentSessions = db.prepare<[number], RecentSession>(`
    SELECT
      qs.id,
      qs.mode,
      COUNT(CASE WHEN qa.is_correct = 1 THEN 1 END)  AS correctCount,
      COUNT(qa.id)                                    AS totalCount,
      ROUND(AVG(CAST(qa.is_correct AS REAL)), 4)      AS correctRate,
      qs.completed_at AS completedAt
    FROM quiz_sessions qs
    LEFT JOIN quiz_answers qa ON qa.session_id = qs.id
    WHERE qs.exam_id = ?
      AND qs.completed_at IS NOT NULL
    GROUP BY qs.id
    ORDER BY qs.completed_at DESC
    LIMIT 10
  `).all(examId);

  return { categoryStats, recentSessions };
}
