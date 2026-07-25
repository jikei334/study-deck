# backend モジュール仕様書

## 概要

Hono + TypeScript によるREST APIサーバー。SQLiteをデータストアとして使用し、クイズ・用語・統計データの永続化とビジネスロジックを担う。初回起動時にAWS Cloud Practitioner の初期データをシーディングする。

---

## 技術スタック

| 技術 | 用途 |
|------|------|
| Hono | Webフレームワーク |
| TypeScript | 型安全 |
| Node.js | ランタイム |
| better-sqlite3 | SQLiteドライバー（同期API） |
| SQLite FTS5 | 用語の全文検索 |

---

## テーブル定義

### exams（試験）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PK, AUTOINCREMENT | |
| name | TEXT | NOT NULL, UNIQUE | 試験名 |
| description | TEXT | | 説明 |
| created_at | TEXT | NOT NULL | ISO8601 |

### categories（カテゴリ）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PK, AUTOINCREMENT | |
| exam_id | INTEGER | FK → exams.id | |
| name | TEXT | NOT NULL | カテゴリ名 |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | 表示順 |

### questions（問題）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PK, AUTOINCREMENT | |
| category_id | INTEGER | FK → categories.id | |
| text | TEXT | NOT NULL | 問題文 |
| explanation | TEXT | | 問題全体の解説（回答後に表示） |
| created_at | TEXT | NOT NULL | ISO8601 |

### choices（選択肢）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PK, AUTOINCREMENT | |
| question_id | INTEGER | FK → questions.id | |
| text | TEXT | NOT NULL | 選択肢のテキスト |
| is_correct | INTEGER | NOT NULL | 1=正解, 0=不正解 |
| explanation | TEXT | | なぜ正解/不正解かの説明 |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | 表示順（0〜3） |

### terms（用語）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PK, AUTOINCREMENT | |
| category_id | INTEGER | FK → categories.id | |
| name | TEXT | NOT NULL | 用語名 |
| description | TEXT | NOT NULL | 説明文 |
| created_at | TEXT | NOT NULL | ISO8601 |

### terms_fts（FTS5 仮想テーブル）

terms テーブルの name・description を全文検索するための FTS5 仮想テーブル。terms の INSERT/UPDATE/DELETE に連動してトリガーで同期する。

### quiz_sessions（クイズセッション）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PK, AUTOINCREMENT | |
| exam_id | INTEGER | FK → exams.id | |
| mode | TEXT | NOT NULL | 'category' / 'random' / 'weak' |
| category_id | INTEGER | NULL許可 | カテゴリ別モード時のみ |
| question_ids | TEXT | NOT NULL | JSON配列（出題順のquestion id列） |
| started_at | TEXT | NOT NULL | ISO8601 |
| completed_at | TEXT | NULL | 完了時刻 |

### quiz_answers（回答）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PK, AUTOINCREMENT | |
| session_id | INTEGER | FK → quiz_sessions.id | |
| question_id | INTEGER | FK → questions.id | |
| selected_choice_id | INTEGER | FK → choices.id | |
| is_correct | INTEGER | NOT NULL | 1=正解, 0=不正解 |
| answered_at | TEXT | NOT NULL | ISO8601 |

---

## APIエンドポイント一覧

### 試験（Exams）

| メソッド | パス | 概要 |
|---------|------|------|
| GET | /api/exams | 試験一覧（累計正答率・クイズ回数も含む） |
| POST | /api/exams | 試験作成 |
| GET | /api/exams/:examId | 試験詳細 |
| PUT | /api/exams/:examId | 試験更新 |
| DELETE | /api/exams/:examId | 試験削除（カテゴリ・問題・セッションもカスケード削除） |

### カテゴリ（Categories）

| メソッド | パス | 概要 |
|---------|------|------|
| GET | /api/exams/:examId/categories | カテゴリ一覧 |
| POST | /api/exams/:examId/categories | カテゴリ作成 |
| PUT | /api/categories/:categoryId | カテゴリ更新 |
| DELETE | /api/categories/:categoryId | カテゴリ削除（問題もカスケード削除） |

### 問題（Questions）

| メソッド | パス | 概要 |
|---------|------|------|
| GET | /api/categories/:categoryId/questions | 問題一覧（選択肢含む） |
| POST | /api/questions | 問題作成（選択肢も同時作成） |
| PUT | /api/questions/:questionId | 問題更新（選択肢も同時更新） |
| DELETE | /api/questions/:questionId | 問題削除（選択肢もカスケード削除） |

### 用語（Terms）

| メソッド | パス | 概要 |
|---------|------|------|
| GET | /api/exams/:examId/terms | 用語一覧（クエリパラメータ: q=検索文字列, categoryId=絞り込み） |
| POST | /api/terms | 用語作成 |
| PUT | /api/terms/:termId | 用語更新 |
| DELETE | /api/terms/:termId | 用語削除 |

### クイズセッション（Quiz Sessions）

| メソッド | パス | 概要 |
|---------|------|------|
| POST | /api/quiz/sessions | セッション開始（問題リスト生成・保存） |
| GET | /api/quiz/sessions/:sessionId | セッション詳細（問題リスト・回答状況） |
| POST | /api/quiz/sessions/:sessionId/answers | 回答記録 |
| PATCH | /api/quiz/sessions/:sessionId/complete | セッション完了 |
| GET | /api/quiz/sessions/:sessionId/result | セッション結果（カテゴリ別集計含む） |

### 統計（Stats）

| メソッド | パス | 概要 |
|---------|------|------|
| GET | /api/exams/:examId/stats | ダッシュボード用統計（カテゴリ別正答率・セッション履歴） |

---

## クイズ問題選択ロジック

### カテゴリ別モード（mode=category）

- 指定 category_id の問題をランダムシャッフルして指定数を返す

### 全問ランダムモード（mode=random）

- exam に紐づく全問題をランダムシャッフルして指定数を返す

### 苦手重点モード（mode=weak）

- 各問題の過去の正答率を算出（quiz_answers から集計）
- 正答率が低い順にソートし、上位を優先して指定数を返す
- 未回答の問題は正答率0%として扱う

---

## リクエスト/レスポンス例

### POST /api/quiz/sessions

```json
// リクエスト
{
  "examId": 1,
  "mode": "category",
  "categoryId": 2,
  "count": 10
}

// レスポンス
{
  "id": 42,
  "examId": 1,
  "mode": "category",
  "questions": [
    {
      "id": 15,
      "text": "EBSスナップショットの特性として正しいものはどれですか？",
      "choices": [
        { "id": 58, "text": "フルバックアップ方式で毎回全データを保存する", "sortOrder": 0 },
        { "id": 59, "text": "増分型バックアップで前回との差分のみ保存する", "sortOrder": 1 },
        { "id": 60, "text": "保存先はEC2インスタンスの直接ストレージ", "sortOrder": 2 },
        { "id": 61, "text": "異なるリージョンへの復元はできない", "sortOrder": 3 }
      ]
    }
  ]
}
```

### POST /api/quiz/sessions/:sessionId/answers

```json
// リクエスト
{
  "questionId": 15,
  "selectedChoiceId": 59
}

// レスポンス
{
  "isCorrect": true,
  "correctChoiceId": 59,
  "selectedChoiceExplanation": "EBSスナップショットは増分型（差分バックアップ）です。前回スナップショット以降の変更分のみを保存するため効率的です。",
  "correctChoiceExplanation": "EBSスナップショットは増分型（差分バックアップ）です。前回スナップショット以降の変更分のみを保存するため効率的です。",
  "questionExplanation": "EBSスナップショットはS3に保存され、異なるリージョンへのコピーも可能です。"
}
```

---

## エラーケース

| ケース | HTTPステータス | レスポンス |
|--------|--------------|-----------|
| 存在しないリソースへのアクセス | 404 | `{ "error": "Not Found" }` |
| バリデーションエラー | 400 | `{ "error": "メッセージ" }` |
| 問題が0件でセッション作成 | 400 | `{ "error": "出題できる問題がありません" }` |
| 完了済みセッションへの回答 | 400 | `{ "error": "このセッションはすでに完了しています" }` |
| 同一問題への二重回答 | 400 | `{ "error": "この問題にはすでに回答済みです" }` |
| DB操作エラー | 500 | `{ "error": "Internal Server Error" }` |

---

## 初期データシーディング

- 起動時に `data/seed.ts` を実行し、DBが空の場合のみシーディング
- AWS Cloud Practitioner 試験・8カテゴリ・約80問・約60用語を挿入
