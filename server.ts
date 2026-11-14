import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import {
  ALL_CLASSES,
  ALL_MCQ_QUESTIONS,
  ALL_QUESTIONS,
  REFLECTION_PARTS,
  STUDENT_PASSWORD,
} from './src/data/questions.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const CONFIG_FILE = path.join(DATA_DIR, 'teacher-config.json');
const PORT = Number(process.env.PORT) || 3000;
const TEACHER_EMAIL = 'slametardea84@guru.smp.belajar.id';

export interface StoredSubmission {
  id: string;
  uid: string;
  email: string;
  nama: string;
  kelas: string;
  absen: number;
  answers: Record<string, string>;
  completedParts: string[];
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

function makeStudentKey(kelas: string, absen: number): string {
  return `${kelas}-${String(absen).padStart(2, '0')}`;
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

function countPartCorrect(answers: Record<string, string>, prefixes: string[]): number {
  let c = 0;
  for (const q of ALL_MCQ_QUESTIONS) {
    if (prefixes.some((p) => q.id.startsWith(p)) && answers[q.id] === q.correctOption) {
      c += 1;
    }
  }
  return c;
}

async function forwardToAppsScript(
  submission: StoredSubmission,
  savedPartId: string
): Promise<boolean> {
  const cfg = await readTeacherConfig();
  const url = cfg.appsScriptWebhookUrl.trim();
  if (!url || !url.startsWith('https://script.google.com/')) return false;

  const partQuestions = (partId: string) => {
    const part = REFLECTION_PARTS.find((p) => p.id === partId);
    if (!part) return [];
    return part.subSections.flatMap((s) => s.questions).map((q) => {
      const ans = submission.answers[q.id] || '';
      const displayAnswer =
        q.type === 'mcq' && ans in q.options
          ? `${ans}. ${q.options[ans as keyof typeof q.options]}`
          : ans;
      return {
        id: q.id,
        prompt: q.prompt,
        answer: displayAnswer,
      };
    });
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: submission.id,
        savedPartId,
        nama: submission.nama,
        kelas: submission.kelas,
        absen: submission.absen,
        completedParts: submission.completedParts,
        skorPgBagian1: countPartCorrect(submission.answers, ['A', 'B', 'C']),
        skorPgBagian2: countPartCorrect(submission.answers, ['D', 'E']),
        skorPgBagian3: countPartCorrect(submission.answers, ['F', 'G']),
        skorPg: submission.skorPg,
        totalPg: submission.totalPg,
        persentasePg: submission.persentasePg,
        submittedAt: submission.submittedAt,
        updatedAt: submission.updatedAt,
        bagian1QA: partQuestions('bagian-1'),
        bagian2QA: partQuestions('bagian-2'),
        bagian3QA: partQuestions('bagian-3'),
        refleksiAkhirQA: partQuestions('refleksi-akhir'),
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Apps Script forward failed:', err);
    return false;
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
    return { valid: false, error: 'Password salah. Gunakan password kegiatan yang diberikan guru.' };
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

  // Student Login check (Nama, Kelas 71-95, Absen 1-30, Password SMPBHATUR)
  app.post('/api/auth/student', async (req, res) => {
    const check = validateStudentIdentity(req.body);
    if (!check.valid || !check.kelas || !check.absen) {
      res.status(400).json({ ok: false, error: check.error });
      return;
    }
    const submissions = await readSubmissions();
    const key = makeStudentKey(check.kelas, check.absen);
    const existing = submissions.find(
      (s) => s.id === key || (s.kelas === check.kelas && s.absen === check.absen)
    );
    res.json({
      ok: true,
      student: { nama: check.nama, kelas: check.kelas, absen: check.absen },
      existingSubmission: existing || null,
    });
  });

  // Save per-part progress (Bagian 1, Bagian 2, Bagian 3, Refleksi Akhir) and forward immediately to teacher Drive Apps Script
  app.post('/api/submissions/part', async (req, res) => {
    const check = validateStudentIdentity(req.body);
    if (!check.valid || !check.nama || !check.kelas || !check.absen) {
      res.status(400).json({ ok: false, error: check.error || 'Identitas tidak lengkap.' });
      return;
    }

    const { partId, answers: rawAnswers } = req.body as {
      partId?: string;
      answers?: Record<string, unknown>;
    };

    const targetPart = REFLECTION_PARTS.find((p) => p.id === partId);
    if (!targetPart) {
      res.status(400).json({ ok: false, error: 'Bagian refleksi tidak dikenali.' });
      return;
    }

    if (!rawAnswers || typeof rawAnswers !== 'object') {
      res.status(400).json({ ok: false, error: 'Jawaban bagian ini belum diisi.' });
      return;
    }

    const partQuestions = targetPart.subSections.flatMap((s) => s.questions);
    for (const q of partQuestions) {
      const val = rawAnswers[q.id];
      if (typeof val !== 'string' || !val.trim()) {
        res.status(400).json({
          ok: false,
          error: `Pertanyaan ${q.id} pada ${targetPart.shortTitle} belum dijawab.`,
          missingQuestionId: q.id,
        });
        return;
      }
      if (q.type === 'mcq' && !['A', 'B', 'C', 'D'].includes(val.trim())) {
        res.status(400).json({ ok: false, error: `Pilihan jawaban ${q.id} tidak valid.` });
        return;
      }
    }

    const studentKey = makeStudentKey(check.kelas, check.absen);
    const now = new Date().toISOString();

    const saved = await enqueueWrite(async () => {
      const list = await readSubmissions();
      const idx = list.findIndex(
        (i) => i.id === studentKey || (i.kelas === check.kelas && i.absen === check.absen)
      );

      const mergedAnswers: Record<string, string> =
        idx >= 0 ? { ...list[idx].answers } : {};
      for (const q of ALL_QUESTIONS) {
        const incomingVal = rawAnswers[q.id];
        if (typeof incomingVal === 'string' && incomingVal.trim()) {
          mergedAnswers[q.id] =
            q.type === 'mcq' ? incomingVal.trim() : incomingVal.trim().slice(0, 2000);
        }
      }

      const prevParts = idx >= 0 && Array.isArray(list[idx].completedParts) ? list[idx].completedParts : [];
      const completedParts = Array.from(new Set([...prevParts, targetPart.id]));

      const { skorPg, totalPg, persentasePg } = computeMcqScore(mergedAnswers);

      const record: StoredSubmission = {
        id: studentKey,
        uid: studentKey,
        email: idx >= 0 ? list[idx].email || '' : '',
        nama: check.nama!,
        kelas: check.kelas!,
        absen: check.absen!,
        answers: mergedAnswers,
        completedParts,
        skorPg,
        totalPg,
        persentasePg,
        submittedAt: idx >= 0 ? list[idx].submittedAt : now,
        updatedAt: now,
      };

      if (idx >= 0) {
        list[idx] = record;
      } else {
        list.push(record);
      }
      await writeSubmissions(list);
      return record;
    });

    const forwardedToDrive = await forwardToAppsScript(saved, targetPart.id);
    res.json({ ok: true, submission: saved, forwardedToDrive });
  });

  // Final full submission endpoint
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
        res.status(400).json({
          ok: false,
          error: `Pertanyaan ${q.id} belum dijawab.`,
          missingQuestionId: q.id,
        });
        return;
      }
      sanitizedAnswers[q.id] = q.type === 'mcq' ? val.trim() : val.trim().slice(0, 2000);
    }

    const { skorPg, totalPg, persentasePg } = computeMcqScore(sanitizedAnswers);
    const studentKey = makeStudentKey(check.kelas, check.absen);
    const now = new Date().toISOString();
    const allPartIds = REFLECTION_PARTS.map((p) => p.id);

    const saved = await enqueueWrite(async () => {
      const list = await readSubmissions();
      const idx = list.findIndex(
        (i) => i.id === studentKey || (i.kelas === check.kelas && i.absen === check.absen)
      );
      const record: StoredSubmission = {
        id: studentKey,
        uid: studentKey,
        email: idx >= 0 ? list[idx].email || '' : '',
        nama: check.nama!,
        kelas: check.kelas!,
        absen: check.absen!,
        answers: sanitizedAnswers,
        completedParts: allPartIds,
        skorPg,
        totalPg,
        persentasePg,
        submittedAt: idx >= 0 ? list[idx].submittedAt : now,
        updatedAt: now,
      };
      if (idx >= 0) {
        list[idx] = record;
      } else {
        list.push(record);
      }
      await writeSubmissions(list);
      return record;
    });

    const forwardedToDrive = await forwardToAppsScript(saved, 'refleksi-akhir');
    res.json({ ok: true, submission: saved, forwardedToDrive });
  });

  // Teacher Google-token verified endpoints
  app.get('/api/teacher/submissions', async (req, res) => {
    const authorized = await verifyTeacherGoogleToken(req.headers.authorization);
    if (!authorized) {
      res.status(401).json({ ok: false, error: 'Otorisasi akun guru diperlukan.' });
      return;
    }
    const list = await readSubmissions();
    list.sort((a, b) => (a.kelas !== b.kelas ? a.kelas.localeCompare(b.kelas) : a.absen - b.absen));
    res.json({ ok: true, submissions: list });
  });

  app.delete('/api/teacher/submissions/:id', async (req, res) => {
    const authorized = await verifyTeacherGoogleToken(req.headers.authorization);
    if (!authorized) {
      res.status(401).json({ ok: false, error: 'Otorisasi akun guru diperlukan.' });
      return;
    }
    const targetId = req.params.id;
    const deleted = await enqueueWrite(async () => {
      const list = await readSubmissions();
      const filtered = list.filter((s) => s.id !== targetId);
      if (filtered.length === list.length) return false;
      await writeSubmissions(filtered);
      return true;
    });
    res.json({ ok: true, deleted });
  });

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
