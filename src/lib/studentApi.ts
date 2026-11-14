import {
  ALL_CLASSES,
  ALL_MCQ_QUESTIONS,
  ALL_QUESTIONS,
  REFLECTION_PARTS,
  STUDENT_PASSWORD,
} from '../data/questions';
import type { StudentIdentity, SubmissionRecord } from '../types';

const VERCEL_APPS_SCRIPT_URL = (
  import.meta.env.VITE_APPS_SCRIPT_URL || ''
).trim();

const LOCAL_SUBMISSION_PREFIX = 'refleksi_submission_record_';

function makeStudentKey(kelas: string, absen: number): string {
  return `${kelas}-${String(absen).padStart(2, '0')}`;
}

function countPartCorrect(
  answers: Record<string, string>,
  prefixes: string[]
): number {
  let c = 0;
  for (const q of ALL_MCQ_QUESTIONS) {
    if (
      prefixes.some((p) => q.id.startsWith(p)) &&
      answers[q.id] === q.correctOption
    ) {
      c += 1;
    }
  }
  return c;
}

function computeScore(answers: Record<string, string>) {
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

function buildAppsScriptPayload(
  submission: SubmissionRecord,
  savedPartId: string
) {
  const partQuestions = (partId: string) => {
    const part = REFLECTION_PARTS.find((p) => p.id === partId);
    if (!part) return [];
    return part.subSections
      .flatMap((s) => s.questions)
      .map((q) => {
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

  return {
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
  };
}

function readLocalSubmission(key: string): SubmissionRecord | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_SUBMISSION_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as SubmissionRecord;
  } catch {
    return null;
  }
}

function writeLocalSubmission(record: SubmissionRecord): void {
  try {
    localStorage.setItem(
      `${LOCAL_SUBMISSION_PREFIX}${record.id}`,
      JSON.stringify(record)
    );
  } catch {
    // ignore storage quota errors
  }
}

function validateLocalIdentity(identity: StudentIdentity): string | null {
  if (identity.password.trim() !== STUDENT_PASSWORD) {
    return 'Password salah. Gunakan password kegiatan yang diberikan guru.';
  }
  if (identity.nama.trim().length < 2 || identity.nama.trim().length > 100) {
    return 'Nama lengkap harus diisi (2–100 karakter).';
  }
  if (!ALL_CLASSES.includes(identity.kelas)) {
    return 'Pilih kelas yang sesuai (71–95).';
  }
  if (
    !Number.isInteger(identity.absen) ||
    identity.absen < 1 ||
    identity.absen > 30
  ) {
    return 'Pilih nomor absen antara 1 sampai 30.';
  }
  return null;
}

async function parseJsonIfExpress(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { isBackendAvailable: false as const, data: null };
  }
  try {
    const data = await response.json();
    return { isBackendAvailable: true as const, data };
  } catch {
    return { isBackendAvailable: false as const, data: null };
  }
}

export async function loginStudent(identity: StudentIdentity): Promise<{
  ok: boolean;
  error?: string;
  student?: StudentIdentity;
  existingSubmission?: SubmissionRecord | null;
}> {
  try {
    const response = await fetch('/api/auth/student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: identity.nama.trim(),
        kelas: identity.kelas,
        absen: identity.absen,
        password: identity.password.trim(),
      }),
    });

    const parsed = await parseJsonIfExpress(response);
    if (parsed.isBackendAvailable) {
      if (!response.ok || !parsed.data?.ok) {
        return {
          ok: false,
          error: parsed.data?.error || 'Identitas atau password tidak sesuai.',
        };
      }
      return {
        ok: true,
        student: {
          nama: parsed.data.student.nama,
          kelas: parsed.data.student.kelas,
          absen: parsed.data.student.absen,
          password: identity.password.trim(),
        },
        existingSubmission: parsed.data.existingSubmission || null,
      };
    }
  } catch {
    // Network / static fallback handled below
  }

  // Fallback for static hosting (e.g., Vercel without Express server.ts)
  const validationErr = validateLocalIdentity(identity);
  if (validationErr) {
    return { ok: false, error: validationErr };
  }

  if (!VERCEL_APPS_SCRIPT_URL.startsWith('https://script.google.com/')) {
    return {
      ok: false,
      error:
        'Server penyimpanan belum aktif pada hosting Vercel statis. Gunakan link resmi aplikasi AI Studio dari guru, atau atur VITE_APPS_SCRIPT_URL pada Environment Variables Vercel.',
    };
  }

  const key = makeStudentKey(identity.kelas, identity.absen);
  return {
    ok: true,
    student: {
      nama: identity.nama.trim(),
      kelas: identity.kelas,
      absen: identity.absen,
      password: identity.password.trim(),
    },
    existingSubmission: readLocalSubmission(key),
  };
}

export async function saveReflectionPart(
  identity: StudentIdentity,
  partId: string,
  answers: Record<string, string>
): Promise<{
  ok: boolean;
  error?: string;
  submission?: SubmissionRecord;
}> {
  try {
    const response = await fetch('/api/submissions/part', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: identity.nama,
        kelas: identity.kelas,
        absen: identity.absen,
        password: identity.password,
        partId,
        answers,
      }),
    });

    const parsed = await parseJsonIfExpress(response);
    if (parsed.isBackendAvailable) {
      if (!response.ok || !parsed.data?.ok) {
        return {
          ok: false,
          error: parsed.data?.error || 'Gagal menyimpan bagian ini.',
        };
      }
      writeLocalSubmission(parsed.data.submission);
      return { ok: true, submission: parsed.data.submission };
    }
  } catch {
    // Fallback for static hosting below
  }

  const validationErr = validateLocalIdentity(identity);
  if (validationErr) return { ok: false, error: validationErr };

  if (!VERCEL_APPS_SCRIPT_URL.startsWith('https://script.google.com/')) {
    return {
      ok: false,
      error:
        'Server penyimpanan tidak ditemukan di Vercel dan VITE_APPS_SCRIPT_URL belum diatur.',
    };
  }

  const key = makeStudentKey(identity.kelas, identity.absen);
  const prev = readLocalSubmission(key);
  const now = new Date().toISOString();
  const sanitized: Record<string, string> = { ...(prev?.answers || {}) };
  for (const q of ALL_QUESTIONS) {
    const v = answers[q.id];
    if (typeof v === 'string' && v.trim()) {
      sanitized[q.id] = q.type === 'mcq' ? v.trim() : v.trim().slice(0, 2000);
    }
  }
  const completedParts = Array.from(
    new Set([...(prev?.completedParts || []), partId])
  );
  const { skorPg, totalPg, persentasePg } = computeScore(sanitized);
  const record: SubmissionRecord = {
    id: key,
    uid: key,
    email: '',
    nama: identity.nama.trim(),
    kelas: identity.kelas,
    absen: identity.absen,
    answers: sanitized,
    completedParts,
    skorPg,
    totalPg,
    persentasePg,
    submittedAt: prev?.submittedAt || now,
    updatedAt: now,
  };

  await fetch(VERCEL_APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(buildAppsScriptPayload(record, partId)),
  });

  writeLocalSubmission(record);
  return { ok: true, submission: record };
}

export async function submitFullReflection(
  identity: StudentIdentity,
  answers: Record<string, string>
): Promise<{
  ok: boolean;
  error?: string;
  submission?: SubmissionRecord;
}> {
  try {
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: identity.nama,
        kelas: identity.kelas,
        absen: identity.absen,
        password: identity.password,
        answers,
      }),
    });

    const parsed = await parseJsonIfExpress(response);
    if (parsed.isBackendAvailable) {
      if (!response.ok || !parsed.data?.ok) {
        return {
          ok: false,
          error: parsed.data?.error || 'Gagal mengirim refleksi akhir.',
        };
      }
      writeLocalSubmission(parsed.data.submission);
      return { ok: true, submission: parsed.data.submission };
    }
  } catch {
    // Fallback for static hosting below
  }

  const validationErr = validateLocalIdentity(identity);
  if (validationErr) return { ok: false, error: validationErr };

  if (!VERCEL_APPS_SCRIPT_URL.startsWith('https://script.google.com/')) {
    return {
      ok: false,
      error:
        'Server penyimpanan tidak ditemukan di Vercel dan VITE_APPS_SCRIPT_URL belum diatur.',
    };
  }

  const key = makeStudentKey(identity.kelas, identity.absen);
  const prev = readLocalSubmission(key);
  const now = new Date().toISOString();
  const sanitized: Record<string, string> = {};
  for (const q of ALL_QUESTIONS) {
    const v = answers[q.id];
    sanitized[q.id] = q.type === 'mcq' ? (v || '').trim() : (v || '').trim().slice(0, 2000);
  }
  const { skorPg, totalPg, persentasePg } = computeScore(sanitized);
  const record: SubmissionRecord = {
    id: key,
    uid: key,
    email: '',
    nama: identity.nama.trim(),
    kelas: identity.kelas,
    absen: identity.absen,
    answers: sanitized,
    completedParts: REFLECTION_PARTS.map((p) => p.id),
    skorPg,
    totalPg,
    persentasePg,
    submittedAt: prev?.submittedAt || now,
    updatedAt: now,
  };

  await fetch(VERCEL_APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(buildAppsScriptPayload(record, 'refleksi-akhir')),
  });

  writeLocalSubmission(record);
  return { ok: true, submission: record };
}
