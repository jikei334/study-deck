import db from './client.js';

export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exams (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      description TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id    INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS questions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      text        TEXT    NOT NULL,
      explanation TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS choices (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      text        TEXT    NOT NULL,
      is_correct  INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
      explanation TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS terms (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS terms_fts USING fts5(
      name,
      description,
      content='terms',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS terms_ai AFTER INSERT ON terms BEGIN
      INSERT INTO terms_fts(rowid, name, description)
        VALUES (new.id, new.name, new.description);
    END;

    CREATE TRIGGER IF NOT EXISTS terms_au AFTER UPDATE ON terms BEGIN
      INSERT INTO terms_fts(terms_fts, rowid, name, description)
        VALUES ('delete', old.id, old.name, old.description);
      INSERT INTO terms_fts(rowid, name, description)
        VALUES (new.id, new.name, new.description);
    END;

    CREATE TRIGGER IF NOT EXISTS terms_ad AFTER DELETE ON terms BEGIN
      INSERT INTO terms_fts(terms_fts, rowid, name, description)
        VALUES ('delete', old.id, old.name, old.description);
    END;

    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id      INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      mode         TEXT    NOT NULL CHECK (mode IN ('category', 'random', 'weak')),
      category_id  INTEGER REFERENCES categories(id),
      question_ids TEXT    NOT NULL,
      started_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS quiz_answers (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id         INTEGER NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
      question_id        INTEGER NOT NULL REFERENCES questions(id),
      selected_choice_id INTEGER NOT NULL REFERENCES choices(id),
      is_correct         INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
      answered_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (session_id, question_id)
    );
  `);

  console.log('マイグレーション完了');
}
