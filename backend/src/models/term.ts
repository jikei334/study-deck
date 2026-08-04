import db from '../db/client.js';

export interface TermRow {
  id: number;
  categoryId: number;
  categoryName: string;
  examId: number;
  name: string;
  description: string;
  createdAt: string;
}

const SELECT_FIELDS = `
  t.id,
  t.category_id  AS categoryId,
  c.name         AS categoryName,
  c.exam_id      AS examId,
  t.name,
  t.description,
  t.created_at   AS createdAt
`;

export function findTermsByExamId(examId: number, q?: string, categoryId?: number): TermRow[] {
  if (q && q.trim()) {
    const trimmed = q.trim();
    const catFilter = categoryId ? 'AND t.category_id = ?' : '';

    if (trimmed.length >= 3) {
      // FTS5 trigram検索: クエリを引用符でエスケープしてFTS5構文エラーを防ぐ
      const ftsQuery = `"${trimmed.replace(/"/g, '""')}"`;
      try {
        return db.prepare(`
          SELECT ${SELECT_FIELDS}
          FROM terms_fts
          JOIN terms t ON t.id = terms_fts.rowid
          JOIN categories c ON c.id = t.category_id
          WHERE terms_fts MATCH ?
            AND c.exam_id = ?
            ${catFilter}
          ORDER BY rank
        `).all(...[ftsQuery, examId, ...(categoryId ? [categoryId] : [])]) as TermRow[];
      } catch {
        // FTS5クエリが解析できない場合はLIKEへフォールバック
      }
    }

    // 2文字以下またはFTS5失敗時: LIKE検索
    const pattern = `%${trimmed}%`;
    return db.prepare(`
      SELECT ${SELECT_FIELDS}
      FROM terms t
      JOIN categories c ON c.id = t.category_id
      WHERE (t.name LIKE ? OR t.description LIKE ?)
        AND c.exam_id = ?
        ${catFilter}
      ORDER BY c.sort_order, t.name
    `).all(...[pattern, pattern, examId, ...(categoryId ? [categoryId] : [])]) as TermRow[];
  }

  return db.prepare(`
    SELECT ${SELECT_FIELDS}
    FROM terms t
    JOIN categories c ON c.id = t.category_id
    WHERE c.exam_id = ?
      ${categoryId ? 'AND t.category_id = ?' : ''}
    ORDER BY c.sort_order, t.name
  `).all(...[examId, ...(categoryId ? [categoryId] : [])]) as TermRow[];
}

export function findTermById(id: number): TermRow | undefined {
  return db.prepare(`
    SELECT ${SELECT_FIELDS}
    FROM terms t
    JOIN categories c ON c.id = t.category_id
    WHERE t.id = ?
  `).get(id) as TermRow | undefined;
}

export function createTerm(categoryId: number, name: string, description: string): TermRow {
  const res = db.prepare(
    'INSERT INTO terms (category_id, name, description) VALUES (?, ?, ?)'
  ).run(categoryId, name, description);
  return findTermById(res.lastInsertRowid as number)!;
}

export function updateTerm(id: number, name: string, description: string): TermRow | undefined {
  const result = db.prepare(
    'UPDATE terms SET name = ?, description = ? WHERE id = ?'
  ).run(name, description, id);
  if (result.changes === 0) return undefined;
  return findTermById(id);
}

export function deleteTerm(id: number): boolean {
  return db.prepare('DELETE FROM terms WHERE id = ?').run(id).changes > 0;
}
