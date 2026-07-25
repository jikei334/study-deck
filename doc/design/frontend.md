# frontend 設計書

## ディレクトリ構成

```
frontend/
├── src/
│   ├── main.tsx              # エントリポイント
│   ├── App.tsx               # ルーティング定義
│   ├── api/
│   │   ├── client.ts         # Axios インスタンス
│   │   ├── exams.ts          # 試験API
│   │   ├── categories.ts     # カテゴリAPI
│   │   ├── questions.ts      # 問題API
│   │   ├── terms.ts          # 用語API
│   │   ├── quiz.ts           # クイズセッションAPI
│   │   └── stats.ts          # 統計API
│   ├── pages/
│   │   ├── ExamSelectPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── QuizSetupPage.tsx
│   │   ├── QuizSessionPage.tsx
│   │   ├── QuizResultPage.tsx
│   │   ├── TermsPage.tsx
│   │   └── AdminPage.tsx
│   ├── components/
│   │   ├── common/
│   │   │   ├── Layout.tsx          # ヘッダー・サイドバー・メインエリア
│   │   │   ├── Toast.tsx           # エラー・成功通知
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── ConfirmDialog.tsx   # 削除確認モーダル
│   │   ├── charts/
│   │   │   ├── CategoryRadarChart.tsx
│   │   │   └── CategoryBarChart.tsx
│   │   ├── quiz/
│   │   │   ├── QuizCard.tsx        # 問題文＋選択肢
│   │   │   ├── ChoiceButton.tsx    # 選択肢ボタン
│   │   │   └── ProgressBar.tsx     # 進捗バー
│   │   └── admin/
│   │       ├── QuestionForm.tsx    # 問題追加・編集フォーム
│   │       ├── TermForm.tsx        # 用語追加・編集フォーム
│   │       └── DataTable.tsx       # 汎用テーブル（ページング付き）
│   └── types/
│       └── index.ts               # 共通型定義（APIレスポンス型など）
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── Dockerfile
```

---

## モジュール間依存関係

```
App.tsx (Router)
  ├── ExamSelectPage     ← api/exams, api/stats
  ├── DashboardPage      ← api/stats, api/exams, api/categories
  ├── QuizSetupPage      ← api/categories
  ├── QuizSessionPage    ← api/quiz
  ├── QuizResultPage     ← api/quiz
  ├── TermsPage          ← api/terms, api/categories
  └── AdminPage          ← api/exams, api/categories, api/questions, api/terms

共通コンポーネント (common/*, charts/*, quiz/*, admin/*)
  └── ← 各ページから import
```

---

## ルーティング

```tsx
// App.tsx
<Routes>
  <Route path="/"                                  element={<ExamSelectPage />} />
  <Route path="/exams/:examId"                     element={<DashboardPage />} />
  <Route path="/exams/:examId/quiz"                element={<QuizSetupPage />} />
  <Route path="/quiz/sessions/:sessionId"          element={<QuizSessionPage />} />
  <Route path="/quiz/sessions/:sessionId/result"   element={<QuizResultPage />} />
  <Route path="/exams/:examId/terms"               element={<TermsPage />} />
  <Route path="/admin"                             element={<AdminPage />} />
</Routes>
```

---

## 各ページ設計

### ExamSelectPage

**状態**

```ts
exams: ExamSummary[]   // GET /api/exams の結果
loading: boolean
error: string | null
```

**レイアウト**

```
[ヘッダー: "study-deck"]
[試験カードグリッド]
  [ExamCard]
    - 試験名（大）
    - 説明文
    - クイズ回数 / 全体正答率
    → クリックで /exams/:examId へ
[+ 試験を追加 → /admin]
```

---

### DashboardPage

**状態**

```ts
exam: Exam
stats: ExamStats        // GET /api/exams/:examId/stats
loading: boolean
```

**レイアウト**

```
[ヘッダー: 試験名 | [クイズを始める] [用語を検索]]
[2カラム]
  左: CategoryRadarChart（カテゴリ別正答率）
  右: CategoryBarChart（正答率低い順ソート）
[セッション履歴テーブル]
  列: 日時 / モード / スコア / 正答率
  最新10件、新しい順
```

**CategoryRadarChart props**

```ts
interface Props {
  data: { categoryName: string; correctRate: number }[];
}
```

**CategoryBarChart props**

```ts
interface Props {
  data: { categoryName: string; correctRate: number; totalAnswered: number }[];
}
// 正答率昇順ソート（苦手を左に）
```

---

### QuizSetupPage

**状態**

```ts
mode: 'category' | 'random' | 'weak'
categoryId: number | null
count: 10 | 20 | null   // null = 全問
categories: Category[]
submitting: boolean
```

**レイアウト**

```
[見出し: クイズ設定]
[モード選択 ラジオボタン]
  ○ カテゴリ別
  ○ 全問ランダム
  ○ 苦手重点
[カテゴリ選択 ドロップダウン] ← カテゴリ別モード時のみ表示
[出題数 ラジオボタン: 10問 / 20問 / 全問]
[クイズ開始 ボタン]
```

**クイズ開始処理**

1. POST /api/quiz/sessions でセッション作成
2. 返却された sessionId で `/quiz/sessions/:sessionId` へ navigate

---

### QuizSessionPage

**状態**

```ts
session: QuizSession          // POST レスポンスで取得済み (location.state 経由)
currentIndex: number          // 現在の問題インデックス
selectedChoiceId: number | null
answerResult: AnswerResult | null  // POST /answers のレスポンス
submitting: boolean
```

**レイアウト（回答前）**

```
[ProgressBar: {currentIndex+1} / {total} | 正解: {correctCount}]
[QuizCard]
  [問題文]
  [ChoiceButton × 4]  ← 押すと回答API呼び出し
```

**レイアウト（回答後）**

```
[ProgressBar]
[QuizCard]
  [問題文]
  [ChoiceButton × 4]
    - 正解: 緑背景
    - 選んだ不正解: 赤背景
    - その他: グレー
  [選んだ選択肢の explanation]（赤または緑ラベル付き）
  [正解選択肢の explanation]（正解でない場合のみ追加表示）
  [問題全体の explanation]
  [次の問題へ ボタン / 結果を見る ボタン（最後の問題）]
```

**ChoiceButton の状態**

```ts
type ChoiceState = 'default' | 'selected-correct' | 'selected-wrong' | 'correct' | 'disabled'
```

---

### QuizResultPage

**状態**

```ts
result: SessionResult    // GET /api/quiz/sessions/:id/result
loading: boolean
```

**レイアウト**

```
[スコアサマリー]
  {correctCount} / {totalCount} 正解  {correctRate}%
  所要時間: {minutes}分{seconds}秒

[CategoryBarChart（このセッションのカテゴリ別正答率）]

[正誤一覧テーブル]
  列: # / 問題文（省略）/ 選択した答え / 正解 / ○×

[もう一度 ボタン → /exams/:examId/quiz]
[ダッシュボードへ ボタン → /exams/:examId]
```

---

### TermsPage

**状態**

```ts
terms: Term[]
query: string             // 検索文字列（300ms デバウンス）
categoryId: number | null // フィルタ
categories: Category[]
loading: boolean
```

**レイアウト**

```
[検索ボックス] [カテゴリフィルター ドロップダウン]
[用語カードリスト]
  [TermCard]
    - 用語名（太字大）
    - カテゴリ名（バッジ）
    - 説明文
```

**検索実装**

- 入力のたびに 300ms デバウンスで GET /api/exams/:examId/terms?q=... を呼び出す

---

### AdminPage

**状態**

```ts
activeTab: 'exams' | 'categories' | 'questions' | 'terms'
selectedExamId: number | null
selectedCategoryId: number | null
// 各タブのデータは activeTab 変更時・操作後に再取得
```

**レイアウト**

```
[タブ: 試験 / カテゴリ / 問題 / 用語]
[フィルター（カテゴリ・問題・用語タブ時）]
  試験選択ドロップダウン → カテゴリ選択ドロップダウン

[DataTable]
  列・行はタブに応じて変化
  各行に [編集] [削除] ボタン

[追加フォーム（アコーディオン or モーダル）]
```

**QuestionForm props**

```ts
interface Props {
  categoryId: number;
  initialValue?: Question;   // 編集時
  onSubmit: (data: QuestionInput) => void;
  onCancel: () => void;
}
// choices[4] の各フィールド: text, isCorrect, explanation
```

---

## 状態管理方針

- 外部ライブラリ（Redux/Zustand 等）は使用しない
- 各ページで `useState` + `useEffect` でAPIデータを取得
- Toast 通知は Context で管理（`ToastContext`）
- ページ間のデータ受け渡しは React Router の `location.state` を使用（クイズセッション情報のみ）

---

## API クライアント設計

```ts
// api/client.ts
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
});

// レスポンスインターセプターでエラーを統一処理
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error ?? '通信エラーが発生しました';
    throw new Error(message);
  }
);
```

---

## エラーケース

| ケース | 対応 |
|--------|------|
| API 通信失敗 | Toast でエラーメッセージ表示（3秒自動消去） |
| 問題 0 件でクイズ開始 | クイズ開始前にバリデーション → 警告 Toast |
| 存在しない examId | DashboardPage でローディング後に「試験が見つかりません」表示 → ホームへボタン |
| 存在しない sessionId | QuizSessionPage で「セッションが見つかりません」→ ホームへボタン |
| 管理画面 削除操作 | ConfirmDialog で確認後に削除実行 |
| ネットワーク切断 | Axios タイムアウト（10秒）後に Toast 表示 |
