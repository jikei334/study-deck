import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';

// インメモリDBでマイグレーションをテスト
// client.tsのシングルトンを使わず独立したDBを生成する
function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return db;
}

function migrateTestDb(db: InstanceType<typeof Database>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      explanation TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS choices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
      explanation TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      mode TEXT NOT NULL CHECK (mode IN ('category', 'random', 'weak')),
      category_id INTEGER REFERENCES categories(id),
      question_ids TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS quiz_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES questions(id),
      selected_choice_id INTEGER NOT NULL REFERENCES choices(id),
      is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
      answered_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (session_id, question_id)
    );
  `);
}

describe('マイグレーション', () => {
  let db: InstanceType<typeof Database>;

  beforeAll(() => {
    db = createTestDb();
    migrateTestDb(db);
  });

  const expectedTables = [
    'exams',
    'categories',
    'questions',
    'choices',
    'terms',
    'quiz_sessions',
    'quiz_answers',
  ];

  it.each(expectedTables)('%s テーブルが作成されている', (tableName) => {
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(tableName);
    expect(row).toBeTruthy();
  });

  it('exams への INSERT と外部キー制約が動作する', () => {
    db.prepare(`INSERT INTO exams (name, description) VALUES (?, ?)`).run(
      'テスト試験',
      'テスト用'
    );
    const exam = db.prepare(`SELECT * FROM exams WHERE name=?`).get('テスト試験') as { id: number };
    expect(exam).toBeTruthy();

    // 外部キー制約: 存在しない exam_id でカテゴリ作成は失敗する
    expect(() => {
      db.prepare(`INSERT INTO categories (exam_id, name) VALUES (?, ?)`).run(9999, '不正カテゴリ');
    }).toThrow();
  });

  it('choices の is_correct CHECK 制約が動作する', () => {
    // セットアップ
    const examId = (db.prepare(`SELECT id FROM exams LIMIT 1`).get() as { id: number }).id;
    db.prepare(`INSERT INTO categories (exam_id, name) VALUES (?, ?)`).run(examId, 'テストカテゴリ');
    const catId = (db.prepare(`SELECT id FROM categories LIMIT 1`).get() as { id: number }).id;
    db.prepare(`INSERT INTO questions (category_id, text) VALUES (?, ?)`).run(catId, 'テスト問題');
    const qId = (db.prepare(`SELECT id FROM questions LIMIT 1`).get() as { id: number }).id;

    // is_correct に 0/1 以外を入れると失敗
    expect(() => {
      db.prepare(`INSERT INTO choices (question_id, text, is_correct) VALUES (?, ?, ?)`).run(qId, '選択肢', 2);
    }).toThrow();
  });

  it('quiz_answers の UNIQUE 制約が動作する（同一問題への二重回答を防ぐ）', () => {
    const examId = (db.prepare(`SELECT id FROM exams LIMIT 1`).get() as { id: number }).id;
    db.prepare(
      `INSERT INTO quiz_sessions (exam_id, mode, question_ids) VALUES (?, ?, ?)`
    ).run(examId, 'random', '[1]');
    const sessionId = (db.prepare(`SELECT id FROM quiz_sessions LIMIT 1`).get() as { id: number }).id;
    const qId = (db.prepare(`SELECT id FROM questions LIMIT 1`).get() as { id: number }).id;

    db.prepare(`INSERT INTO choices (question_id, text, is_correct) VALUES (?, ?, ?)`).run(qId, '正解', 1);
    const choiceId = (db.prepare(`SELECT id FROM choices LIMIT 1`).get() as { id: number }).id;

    db.prepare(
      `INSERT INTO quiz_answers (session_id, question_id, selected_choice_id, is_correct) VALUES (?, ?, ?, ?)`
    ).run(sessionId, qId, choiceId, 1);

    // 同一 session_id + question_id の二重回答は失敗
    expect(() => {
      db.prepare(
        `INSERT INTO quiz_answers (session_id, question_id, selected_choice_id, is_correct) VALUES (?, ?, ?, ?)`
      ).run(sessionId, qId, choiceId, 1);
    }).toThrow();
  });
});
