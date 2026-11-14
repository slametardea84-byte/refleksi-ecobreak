import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { ALL_CLASSES, ALL_MCQ_QUESTIONS, ALL_QUESTIONS, STUDENT_PASSWORD } from './src/data/questions.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const CONFIG_FILE = path.join(DATA_DIR, 'teacher-config.json');
const PORT = Number(process.env.PORT) || 3000;
const TEACHER_EMAIL = 'slametardea84@guru.smp.belajar.id';

export interface StoredSubmission {
  id: string;
  uid?: string;
  email?: string;
  nama: string;
  kelas: string;
  absen: number;
  answers: Record<string, string>;
  skorPg: number;
  totalPg: number;
  persentasePg: number;
  submittedAt: string;
  updatedAt: string;
}

interface TeacherConfig {
  appsScriptWebhookUrl: string;
  updatedAt: string;
}

let writeQueue: Promise<void> = Promise.resolve();

async function ensureDataFiles(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(SUBMISSIONS_FILE);
  } catch {
    await fs.writeFile(SUBMISSIONS_FILE, '[]', 'utf8');
  }
  try {
    await fs.access(CONFIG_FILE);
  } catch {
    await fs.writeFile(
      CONFIG_FILE,
      JSON.stringify({ appsScriptWebhookUrl: '', updatedAt: '' }, null, 2),
      'utf8'
    );
  }
}

async function readSubmissions(): Promise<StoredSubmission[]> {
  await ensureDataFiles();
  try {
    const raw = await fs.readFile(SUBMISSIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSubmissions(list: StoredSubmission[]): Promise<void> {
  await ensureDataFiles();
  const tempFile = `${SUBMISSIONS_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(list, null, 2), 'utf8');
  await fs.rename(tempFile, SUBMISSIONS_FILE);
}

async function readTeacherConfig(): Promise<TeacherConfig> {
  await ensureDataFiles();
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      appsScriptWebhookUrl: String(parsed?.appsScriptWebhookUrl || ''),
      updatedAt: String(parsed?.updatedAt || ''),
    };
  } catch {
    return { appsScriptWebhookUrl: '', updatedAt: '' };
  }
}

async function writeTeacherConfig(cfg: TeacherConfig): Promise<void> {
  await ensureDataFiles();
  const tempFile = `${CONFIG_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(cfg, null, 2), 'utf8');
  await fs.rename(tempFile, CONFIG_FILE);
}

function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(task, task);
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function verifyTeacherGoogleToken(authHeader?: string): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return false;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const info = (await res.json()) as { email?: string; email_verified?: boolean };
    return (
      Boolean(info.email_verified) &&
      String(info.email || '').toLowerCase() === TEACHER_EMAIL.toLowerCase()
    );
  } catch {
    return false;
  }
}

async function forwardToAppsScript(submission: StoredSubmission): Promise<void> {
  const cfg = await readTeacherConfig();
  const url = cfg.appsScriptWebhookUrl.trim();
  if (!url || !url.startsWith('https://script.google.com/')) return;

  const questionAnswerPairs = ALL_QUESTIONS.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    answer: submission.answers[q.id] || '',
  }));

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: submission.id,
        uid: submission.uid || submission.id,
        email: submission.email || '',
        nama: submission.nama,
        kelas: submission.kelas,
        absen: submission.absen,
        skorPg: submission.skorPg,
        totalPg: submission.totalPg,
        persentasePg: submission.persentasePg,
        submittedAt: submission.submittedAt,
        updatedAt: submission.updatedAt,
        answers: submission.answers,
        questionsAndAnswers: questionAnswerPairs,
      }),
    });
  } catch (err) {
    console.error('Apps Script forward failed:', err);
  }
}

function validateStudentIdentity(body: unknown): {
  valid: boolean;
  error?: string;
  nama?: string;
  kelas?: string;
  absen?: number;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Data identitas tidak valid.' };
  }
  const { nama, kelas, absen, password } = body as Record<string, unknown>;

  if (typeof password !== 'string' || password.trim() !== STUDENT_PASSWORD) {
    return { valid: false, error: 'Password salah. Gunakan password sekolah yang diberikan guru.' };
  }

  if (typeof nama !== 'string' || nama.trim().length < 2 || nama.trim().length > 100) {
    return { valid: false, error: 'Nama lengkap harus diisi (2–100 karakter).' };
  }

  if (typeof kelas !== 'string' || !ALL_CLASSES.includes(kelas)) {
    return { valid: false, error: 'Pilih kelas yang sesuai (71–95).' };
  }

  const absenNum = Number(absen);
  if (!Number.isInteger(absenNum) || absenNum < 1 || absenNum > 30) {
    return { valid: false, error: 'Pilih nomor absen antara 1 sampai 30.' };
  }

  return {
    valid: true,
    nama: nama.trim(),
    kelas,
    absen: absenNum,
  };
}

function computeMcqScore(answers: Record<string, string>) {
  let correct = 0;
  for (const q of ALL_MCQ_QUESTIONS) {
    if (answers[q.id] === q.correctOption) {
      correct += 1;
    }
  }
  const totalPg = ALL_MCQ_QUESTIONS.length;
  const persentasePg = totalPg > 0 ? Math.round((correct / totalPg) * 100) : 0;
  return { skorPg: correct, totalPg, persentasePg };
}

async function startServer() {
  await ensureDataFiles();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Mirror student submission from Firestore client to local backup & optional Apps Script webhook
  app.post('/api/mirror-submission', async (req, res) => {
    const body = req.body as Partial<StoredSubmission> | undefined;
    if (!body || !body.uid || !body.nama || !body.kelas || !body.absen || !body.answers) {
      res.status(400).json({ ok: false, error: 'Payload tidak lengkap.' });
      return;
    }

    const sanitizedAnswers: Record<string, string> = {};
    for (const q of ALL_QUESTIONS) {
      const val = String((body.answers as Record<string, unknown>)[q.id] || '').trim();
      sanitizedAnswers[q.id] = q.type === 'mcq' ? val : val.slice(0, 2000);
    }

    const { skorPg, totalPg, persentasePg } = computeMcqScore(sanitizedAnswers);
    const now = new Date().toISOString();

    const record: StoredSubmission = {
      id: String(body.uid),
      uid: String(body.uid),
      email: String(body.email || ''),
      nama: String(body.nama).trim().slice(0, 100),
      kelas: String(body.kelas),
      absen: Number(body.absen),
      answers: sanitizedAnswers,
      skorPg,
      totalPg,
      persentasePg,
      submittedAt: String(body.submittedAt || now),
      updatedAt: now,
    };

    await enqueueWrite(async () => {
      const list = await readSubmissions();
      const idx = list.findIndex((s) => s.id === record.id);
      if (idx >= 0) {
        list[idx] = { ...record, submittedAt: list[idx].submittedAt || record.submittedAt };
      } else {
        list.push(record);
      }
      await writeSubmissions(list);
    });

    // Fire Apps Script webhook if configured by teacher
    await forwardToAppsScript(record);
    res.json({ ok: true });
  });

  // Teacher Google token-verified webhook settings
  app.get('/api/teacher/webhook', async (req, res) => {
    const authorized = await verifyTeacherGoogleToken(req.headers.authorization);
    if (!authorized) {
      res.status(401).json({ ok: false, error: 'Otorisasi guru diperlukan.' });
      return;
    }
    const cfg = await readTeacherConfig();
    res.json({ ok: true, appsScriptWebhookUrl: cfg.appsScriptWebhookUrl, updatedAt: cfg.updatedAt });
  });

  app.post('/api/teacher/webhook', async (req, res) => {
    const authorized = await verifyTeacherGoogleToken(req.headers.authorization);
    if (!authorized) {
      res.status(401).json({ ok: false, error: 'Otorisasi guru diperlukan.' });
      return;
    }
    const url = String((req.body as Record<string, unknown>)?.appsScriptWebhookUrl || '').trim();
    if (url && !url.startsWith('https://script.google.com/')) {
      res.status(400).json({
        ok: false,
        error: 'URL harus berupa Web App Google Apps Script (https://script.google.com/...).',
      });
      return;
    }
    const cfg: TeacherConfig = {
      appsScriptWebhookUrl: url,
      updatedAt: new Date().toISOString(),
    };
    await writeTeacherConfig(cfg);
    res.json({ ok: true, appsScriptWebhookUrl: cfg.appsScriptWebhookUrl, updatedAt: cfg.updatedAt });
  });

  // Legacy student check endpoint kept compatible
  app.post('/api/auth/student', async (req, res) => {
    const check = validateStudentIdentity(req.body);
    if (!check.valid) {
      res.status(400).json({ ok: false, error: check.error });
      return;
    }
    const submissions = await readSubmissions();
    const existing = submissions.find(
      (s) => s.kelas === check.kelas && s.absen === check.absen
    );
    res.json({
      ok: true,
      student: { nama: check.nama, kelas: check.kelas, absen: check.absen },
      existingSubmission: existing || null,
    });
  });

  app.post('/api/submissions', async (req, res) => {
    const check = validateStudentIdentity(req.body);
    if (!check.valid || !check.nama || !check.kelas || !check.absen) {
      res.status(400).json({ ok: false, error: check.error || 'Identitas tidak lengkap.' });
      return;
    }
    const rawAnswers = (req.body as Record<string, unknown>).answers;
    if (!rawAnswers || typeof rawAnswers !== 'object') {
      res.status(400).json({ ok: false, error: 'Jawaban refleksi belum diisi.' });
      return;
    }
    const sanitizedAnswers: Record<string, string> = {};
    for (const q of ALL_QUESTIONS) {
      const val = (rawAnswers as Record<string, unknown>)[q.id];
      if (typeof val !== 'string' || !val.trim()) {
        res.status(400).json({ ok: false, error: `Pertanyaan ${q.id} belum dijawab.` });
        return;
      }
      sanitizedAnswers[q.id] = q.type === 'mcq' ? val.trim() : val.trim().slice(0, 2000);
    }
    const { skorPg, totalPg, persentasePg } = computeMcqScore(sanitizedAnswers);
    const now = new Date().toISOString();
    const saved = await enqueueWrite(async () => {
      const list = await readSubmissions();
      const idx = list.findIndex((i) => i.kelas === check.kelas && i.absen === check.absen);
      if (idx >= 0) {
        const updated: StoredSubmission = {
          ...list[idx],
          nama: check.nama!,
          answers: sanitizedAnswers,
          skorPg,
          totalPg,
          persentasePg,
          updatedAt: now,
        };
        list[idx] = updated;
        await writeSubmissions(list);
        return updated;
      }
      const created: StoredSubmission = {
        id: crypto.randomUUID(),
        nama: check.nama!,
        kelas: check.kelas!,
        absen: check.absen!,
        answers: sanitizedAnswers,
        skorPg,
        totalPg,
        persentasePg,
        submittedAt: now,
        updatedAt: now,
      };
      list.push(created);
      await writeSubmissions(list);
      return created;
    });
    await forwardToAppsScript(saved);
    res.json({ ok: true, submission: saved });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
