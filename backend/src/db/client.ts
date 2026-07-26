import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '../../../data/study-deck.db');

// DBファイルの親ディレクトリが存在しない場合は作成する
if (DB_PATH !== ':memory:') {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);

// パフォーマンス向上のため WAL モードを有効化
db.pragma('journal_mode = WAL');
// 外部キー制約を有効化
db.pragma('foreign_keys = ON');

export default db;
