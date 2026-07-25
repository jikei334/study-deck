# backend 設計書

## ディレクトリ構成

```
backend/
├── src/
│   ├── index.ts              # エントリポイント・Honoアプリ起動
│   ├── db/
│   │   ├── client.ts         # better-sqlite3 インスタンスの初期化
│   │   ├── migrate.ts        # テーブル作成DDL実行
│   │   └── seed.ts           # 初期データ投入（AWS CP）
│   ├── routes/
│   │   ├── exams.ts          # /api/exams
│   │   ├── categories.ts     # /api/exams/:examId/categories, /api/categories/:id
│   │   ├── questions.ts      # /api/categories/:id/questions, /api/questions/:id
│   │   ├── terms.ts          # /api/exams/:examId/terms, /api/terms/:id
│   │   ├── quiz.ts           # /api/quiz/sessions
│   │   └── stats.ts          # /api/exams/:examId/stats
│   ├── models/
│   │   ├── exam.ts
│   │   ├── category.ts
│   │   ├── question.ts
│   │   ├── term.ts
│   │   └── quizSession.ts
│   └── types.ts              # 共通型定義
├── data/
│   └── seed-aws-cp.ts        # AWS CP の問題・用語データ
├── package.json
├── tsconfig.json
└── Dockerfile
```

---

## レイヤー構成

```
[Hono Router] → [Route Handler] → [Model (SQL)] → [SQLite DB]
```

- **Route Handler**: リクエストのバリデーション・レスポンス整形
- **Model**: SQL クエリの実行・ビジネスロジック（問題選択アルゴリズム等）
- **DB Client**: シングルトンの better-sqlite3 インスタンス

---

## データベース DDL

```sql
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
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id  INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text         TEXT    NOT NULL,
  is_correct   INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  explanation  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS terms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- FTS5 仮想テーブル
CREATE VIRTUAL TABLE IF NOT EXISTS terms_fts USING fts5(
  name,
  description,
  content='terms',
  content_rowid='id'
);

-- terms と terms_fts を同期するトリガー
CREATE TRIGGER IF NOT EXISTS terms_ai AFTER INSERT ON terms BEGIN
  INSERT INTO terms_fts(rowid, name, description) VALUES (new.id, new.name, new.description);
END;
CREATE TRIGGER IF NOT EXISTS terms_au AFTER UPDATE ON terms BEGIN
  INSERT INTO terms_fts(terms_fts, rowid, name, description) VALUES('delete', old.id, old.name, old.description);
  INSERT INTO terms_fts(rowid, name, description) VALUES (new.id, new.name, new.description);
END;
CREATE TRIGGER IF NOT EXISTS terms_ad AFTER DELETE ON terms BEGIN
  INSERT INTO terms_fts(terms_fts, rowid, name, description) VALUES('delete', old.id, old.name, old.description);
END;

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id      INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  mode         TEXT    NOT NULL CHECK (mode IN ('category', 'random', 'weak')),
  category_id  INTEGER REFERENCES categories(id),
  question_ids TEXT    NOT NULL, -- JSON 配列
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
```

---

## APIエンドポイント詳細

### GET /api/exams

**レスポンス**

```json
[
  {
    "id": 1,
    "name": "AWS Cloud Practitioner",
    "description": "AWSの基礎知識を問う試験",
    "totalSessions": 12,
    "overallCorrectRate": 0.73
  }
]
```

- `totalSessions`: quiz_sessions の completed_at IS NOT NULL の件数
- `overallCorrectRate`: quiz_answers の is_correct 平均（全セッション）

---

### POST /api/exams

**リクエスト**

```json
{ "name": "試験名", "description": "説明（省略可）" }
```

**バリデーション**: name は必須・空文字不可

---

### GET /api/exams/:examId/categories

**レスポンス**

```json
[
  {
    "id": 2,
    "name": "ストレージ",
    "sortOrder": 0,
    "questionCount": 12,
    "correctRate": 0.68
  }
]
```

- `questionCount`: questions テーブルから count
- `correctRate`: quiz_answers から算出（0〜1、回答なしの場合は null）

---

### POST /api/questions

**リクエスト**

```json
{
  "categoryId": 2,
  "text": "問題文",
  "explanation": "全体解説（省略可）",
  "choices": [
    { "text": "選択肢A", "isCorrect": false, "explanation": "Aが不正解の理由", "sortOrder": 0 },
    { "text": "選択肢B", "isCorrect": true,  "explanation": "Bが正解の理由",   "sortOrder": 1 },
    { "text": "選択肢C", "isCorrect": false, "explanation": "Cが不正解の理由", "sortOrder": 2 },
    { "text": "選択肢D", "isCorrect": false, "explanation": "Dが不正解の理由", "sortOrder": 3 }
  ]
}
```

**バリデーション**:
- choices は必ず 4 つ
- is_correct が true の選択肢が必ず 1 つ

---

### GET /api/exams/:examId/terms?q=検索文字列&categoryId=1

- `q` 指定時: FTS5 で name・description を全文検索
- `q` 省略時: 全件返却（sort: name ASC）
- `categoryId` 指定時: そのカテゴリのみ

**レスポンス**

```json
[
  {
    "id": 5,
    "name": "Amazon S3",
    "description": "オブジェクトストレージサービス。...",
    "categoryId": 2,
    "categoryName": "ストレージ"
  }
]
```

---

### POST /api/quiz/sessions

**リクエスト**

```json
{
  "examId": 1,
  "mode": "category",
  "categoryId": 2,
  "count": 10
}
```

- `count`: 10 / 20 / null（全問）
- `categoryId`: mode が "category" の場合のみ必須

**処理フロー**

1. モードに応じて問題を選択（後述）
2. 選択した question_id 列を JSON 配列として quiz_sessions に保存
3. セッション ID と問題リスト（選択肢はシャッフル済み）を返却

**レスポンス**

```json
{
  "id": 42,
  "questions": [
    {
      "id": 15,
      "text": "問題文",
      "choices": [
        { "id": 58, "text": "選択肢A", "sortOrder": 0 },
        { "id": 59, "text": "選択肢B", "sortOrder": 1 },
        { "id": 60, "text": "選択肢C", "sortOrder": 2 },
        { "id": 61, "text": "選択肢D", "sortOrder": 3 }
      ]
    }
  ]
}
```

※ choices の `isCorrect` と `explanation` は含めない（回答前）

---

### POST /api/quiz/sessions/:sessionId/answers

**リクエスト**

```json
{ "questionId": 15, "selectedChoiceId": 59 }
```

**バリデーション**:
- questionId が session の question_ids に含まれること
- 同一問題への二重回答でないこと
- セッションが未完了であること

**レスポンス**

```json
{
  "isCorrect": true,
  "correctChoiceId": 59,
  "choices": [
    {
      "id": 58,
      "text": "選択肢A",
      "isCorrect": false,
      "explanation": "Aが不正解の理由"
    },
    {
      "id": 59,
      "text": "選択肢B",
      "isCorrect": true,
      "explanation": "Bが正解の理由"
    }
  ],
  "questionExplanation": "問題全体の解説"
}
```

---

### PATCH /api/quiz/sessions/:sessionId/complete

- completed_at を現在時刻で更新
- リクエストボディなし

---

### GET /api/quiz/sessions/:sessionId/result

**レスポンス**

```json
{
  "id": 42,
  "examId": 1,
  "mode": "category",
  "startedAt": "2026-07-25T10:00:00Z",
  "completedAt": "2026-07-25T10:15:00Z",
  "totalCount": 10,
  "correctCount": 7,
  "correctRate": 0.70,
  "categoryStats": [
    { "categoryId": 2, "categoryName": "ストレージ", "total": 10, "correct": 7, "correctRate": 0.70 }
  ],
  "answers": [
    {
      "questionId": 15,
      "questionText": "問題文",
      "selectedChoiceId": 59,
      "selectedChoiceText": "選択肢B",
      "correctChoiceId": 59,
      "correctChoiceText": "選択肢B",
      "isCorrect": true
    }
  ]
}
```

---

### GET /api/exams/:examId/stats

**レスポンス**

```json
{
  "categoryStats": [
    {
      "categoryId": 2,
      "categoryName": "ストレージ",
      "totalAnswered": 45,
      "correctCount": 31,
      "correctRate": 0.69
    }
  ],
  "recentSessions": [
    {
      "id": 42,
      "mode": "random",
      "correctCount": 7,
      "totalCount": 10,
      "correctRate": 0.70,
      "completedAt": "2026-07-25T10:15:00Z"
    }
  ]
}
```

- `categoryStats`: 全期間の累計（回答なしカテゴリは含まない）
- `recentSessions`: completed_at IS NOT NULL の直近10件（新しい順）

---

## クイズ問題選択アルゴリズム

```typescript
// カテゴリ別モード
function selectByCategory(categoryId: number, count: number | null): number[] {
  const questions = db.prepare(
    'SELECT id FROM questions WHERE category_id = ?'
  ).all(categoryId);
  return shuffle(questions.map(q => q.id)).slice(0, count ?? questions.length);
}

// 全問ランダムモード
function selectRandom(examId: number, count: number | null): number[] {
  const questions = db.prepare(
    'SELECT q.id FROM questions q JOIN categories c ON q.category_id = c.id WHERE c.exam_id = ?'
  ).all(examId);
  return shuffle(questions.map(q => q.id)).slice(0, count ?? questions.length);
}

// 苦手重点モード（正答率の低い順）
function selectWeak(examId: number, count: number | null): number[] {
  const rows = db.prepare(`
    SELECT q.id,
           COALESCE(AVG(CAST(a.is_correct AS REAL)), -1) AS rate
    FROM questions q
    JOIN categories c ON q.category_id = c.id
    LEFT JOIN quiz_answers a ON a.question_id = q.id
    WHERE c.exam_id = ?
    GROUP BY q.id
    ORDER BY rate ASC, RANDOM()
  `).all(examId);
  return rows.map(r => r.id).slice(0, count ?? rows.length);
}
```

- 苦手重点モードで `rate = -1` は未回答（最優先）
- 同一正答率内はランダムで並べる

---

## エラーケース

| ケース | ステータス | メッセージ |
|--------|-----------|-----------|
| 存在しない examId | 404 | `試験が見つかりません` |
| 存在しない categoryId | 404 | `カテゴリが見つかりません` |
| 存在しない questionId | 404 | `問題が見つかりません` |
| 存在しない sessionId | 404 | `セッションが見つかりません` |
| name が空 | 400 | `名前は必須です` |
| choices が 4 つでない | 400 | `選択肢は4つ必要です` |
| 正解の選択肢が 1 つでない | 400 | `正解の選択肢は1つだけ指定してください` |
| 問題が 0 件でセッション作成 | 400 | `出題できる問題がありません` |
| 完了済みセッションへの回答 | 400 | `このセッションはすでに完了しています` |
| 同一問題への二重回答 | 400 | `この問題にはすでに回答済みです` |
| questionId が session に含まれない | 400 | `この問題はセッションに含まれていません` |
| DB エラー | 500 | `Internal Server Error` |
