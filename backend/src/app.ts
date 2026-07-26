import { Hono } from 'hono';
import { cors } from 'hono/cors';
import exams from './routes/exams.js';
import categories from './routes/categories.js';
import stats from './routes/stats.js';
import quiz from './routes/quiz.js';

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
app.route('/api/exams/:examId/categories', categories);
app.route('/api/exams/:examId/stats', stats);
app.route('/api/quiz', quiz);

export default app;
