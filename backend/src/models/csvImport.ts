import db from '../db/client.js';

export interface ImportResult {
  imported: number;
  errors: { row: number; message: string }[];
}

// UTF-8 BOM除去・改行正規化
function normalizeCSV(raw: string): string {
  return raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// 引用符付きフィールドを考慮したCSVパーサ
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(content: string): string[][] {
  return normalizeCSV(content)
    .split('\n')
    .filter(l => l.trim())
    .map(parseCSVLine);
}

function getOrCreateCategoryId(examId: number, categoryName: string, cache: Map<string, number>): number {
  if (cache.has(categoryName)) return cache.get(categoryName)!;

  const existing = db.prepare('SELECT id FROM categories WHERE exam_id = ? AND name = ?').get(examId, categoryName) as { id: number } | undefined;
  if (existing) {
    cache.set(categoryName, existing.id);
    return existing.id;
  }

  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM categories WHERE exam_id = ?').get(examId) as { m: number }).m;
  const res = db.prepare('INSERT INTO categories (exam_id, name, sort_order) VALUES (?, ?, ?)').run(examId, categoryName, maxOrder + 1);
  const id = res.lastInsertRowid as number;
  cache.set(categoryName, id);
  return id;
}

export function importQuestionsFromCSV(examId: number, rawCSV: string): ImportResult {
  const rows = parseCSV(rawCSV);
  // ヘッダー行をスキップ（最初の行）
  if (rows.length <= 1) return { imported: 0, errors: [{ row: 1, message: 'データ行がありません' }] };

  const result: ImportResult = { imported: 0, errors: [] };
  const categoryCache = new Map<string, number>();

  const stmtQ = db.prepare('INSERT INTO questions (category_id, text, explanation) VALUES (?, ?, ?)');
  const stmtC = db.prepare('INSERT INTO choices (question_id, text, is_correct, explanation, sort_order) VALUES (?, ?, ?, ?, ?)');

  db.transaction(() => {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // 最低7列: categoryName, text, choice1-4, correctIndex
      if (row.length < 7) {
        result.errors.push({ row: rowNum, message: `列数不足 (${row.length}列, 最低7列必要)` });
        continue;
      }

      const [categoryName, text, c1, c2, c3, c4, correctIdxStr, explanation] = row;
      const correctIndex = parseInt(correctIdxStr, 10);

      if (!categoryName) { result.errors.push({ row: rowNum, message: 'categoryNameは必須です' }); continue; }
      if (!text) { result.errors.push({ row: rowNum, message: 'textは必須です' }); continue; }
      if (!c1 || !c2 || !c3 || !c4) { result.errors.push({ row: rowNum, message: '選択肢(choice1〜4)はすべて必須です' }); continue; }
      if (isNaN(correctIndex) || correctIndex < 1 || correctIndex > 4) {
        result.errors.push({ row: rowNum, message: 'correctIndexは1〜4の整数である必要があります' });
        continue;
      }

      try {
        const categoryId = getOrCreateCategoryId(examId, categoryName, categoryCache);
        const qRes = stmtQ.run(categoryId, text, explanation?.trim() || null);
        const qId = qRes.lastInsertRowid as number;

        [c1, c2, c3, c4].forEach((choice, j) => {
          stmtC.run(qId, choice, j + 1 === correctIndex ? 1 : 0, null, j + 1);
        });

        result.imported++;
      } catch (err) {
        result.errors.push({ row: rowNum, message: err instanceof Error ? err.message : '不明なエラー' });
      }
    }
  })();

  return result;
}

export function importTermsFromCSV(examId: number, rawCSV: string): ImportResult {
  const rows = parseCSV(rawCSV);
  if (rows.length <= 1) return { imported: 0, errors: [{ row: 1, message: 'データ行がありません' }] };

  const result: ImportResult = { imported: 0, errors: [] };
  const categoryCache = new Map<string, number>();

  const stmtT = db.prepare('INSERT INTO terms (category_id, name, description) VALUES (?, ?, ?)');

  db.transaction(() => {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (row.length < 3) {
        result.errors.push({ row: rowNum, message: `列数不足 (${row.length}列, 最低3列必要)` });
        continue;
      }

      const [categoryName, name, description] = row;

      if (!categoryName) { result.errors.push({ row: rowNum, message: 'categoryNameは必須です' }); continue; }
      if (!name) { result.errors.push({ row: rowNum, message: 'nameは必須です' }); continue; }
      if (!description) { result.errors.push({ row: rowNum, message: 'descriptionは必須です' }); continue; }

      try {
        const categoryId = getOrCreateCategoryId(examId, categoryName, categoryCache);
        stmtT.run(categoryId, name, description);
        result.imported++;
      } catch (err) {
        result.errors.push({ row: rowNum, message: err instanceof Error ? err.message : '不明なエラー' });
      }
    }
  })();

  return result;
}
