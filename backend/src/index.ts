import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { migrate } from './db/migrate.js';

// 起動時にテーブル作成
migrate();

const app = new Hono();

// フロントエンド（開発: localhost:5173）からのアクセスを許可
app.use(
  '/api/*',
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
);

app.get('/api/health', (c) => c.json({ status: 'ok' }));

const PORT = parseInt(process.env.PORT ?? '3000', 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`サーバー起動: http://localhost:${info.port}`);
});

export default app;
