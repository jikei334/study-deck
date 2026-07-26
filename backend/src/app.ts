import { Hono } from 'hono';
import { cors } from 'hono/cors';
import exams from './routes/exams.js';

const app = new Hono();

app.use(
  '/api/*',
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
);

app.get('/api/health', (c) => c.json({ status: 'ok' }));
app.route('/api/exams', exams);

export default app;
