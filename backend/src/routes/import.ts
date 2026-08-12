import { Hono } from 'hono';
import db from '../db/client.js';
import { importQuestionsFromCSV, importTermsFromCSV } from '../models/csvImport.js';

const importRouter = new Hono<{ Variables: { examId: number } }>();

importRouter.use('*', async (c, next) => {
  const examId = parseInt(c.req.param('examId') ?? '', 10);
  if (isNaN(examId)) return c.json({ error: '試験が見つかりません' }, 404);
  const exam = db.prepare('SELECT id FROM exams WHERE id = ?').get(examId);
  if (!exam) return c.json({ error: '試験が見つかりません' }, 404);
  c.set('examId', examId);
  await next();
});

async function readCSVFromRequest(c: Parameters<typeof importRouter.post>[1] extends undefined ? never : any): Promise<string | null> {
  const contentType = c.req.header('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') return null;
    return await (file as File).text();
  }
  if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
    return await c.req.text();
  }
  return null;
}

importRouter.post('/questions', async (c) => {
  const examId = c.get('examId');
  let csv: string | null = null;
  try {
    csv = await readCSVFromRequest(c);
  } catch {
    return c.json({ error: 'リクエストの読み取りに失敗しました' }, 400);
  }
  if (!csv) return c.json({ error: 'CSVファイルが必要です (multipart/form-data の file フィールド、または text/csv ボディ)' }, 400);

  const result = importQuestionsFromCSV(examId, csv);
  return c.json(result, result.imported > 0 || result.errors.length > 0 ? 200 : 400);
});

importRouter.post('/terms', async (c) => {
  const examId = c.get('examId');
  let csv: string | null = null;
  try {
    csv = await readCSVFromRequest(c);
  } catch {
    return c.json({ error: 'リクエストの読み取りに失敗しました' }, 400);
  }
  if (!csv) return c.json({ error: 'CSVファイルが必要です (multipart/form-data の file フィールド、または text/csv ボディ)' }, 400);

  const result = importTermsFromCSV(examId, csv);
  return c.json(result, result.imported > 0 || result.errors.length > 0 ? 200 : 400);
});

export default importRouter;
