import { serve } from '@hono/node-server';
import { migrate } from './db/migrate.js';
import app from './app.js';

// 起動時にテーブル作成
migrate();

const PORT = parseInt(process.env.PORT ?? '3000', 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`サーバー起動: http://localhost:${info.port}`);
});
