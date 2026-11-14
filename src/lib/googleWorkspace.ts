import { ALL_CLASSES, ALL_MCQ_QUESTIONS, ALL_QUESTIONS } from '../data/questions';
import type { SubmissionRecord } from '../types';

export const DRIVE_FOLDER_NAME = 'Refleksi Kokurikuler SMP Kemala Bhayangkari 7 Porong';
export const SPREADSHEET_TITLE = 'Rekap Refleksi Kokurikuler (Kelas 71-95)';
const BACKUP_JSON_NAME = 'backup-refleksi-kokurikuler.json';
const BACKUP_CSV_NAME = 'rekap-refleksi-kokurikuler.csv';

async function driveFetch(
  accessToken: string,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    throw new Error('TOKEN_EXPIRED');
  }
  return res;
}

export async function ensureDriveFolder(
  accessToken: string,
  existingFolderId?: string
): Promise<{ folderId: string; folderName: string }> {
  if (existingFolderId) {
    const check = await driveFetch(
      accessToken,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(existingFolderId)}?fields=id,name,trashed`
    );
    if (check.ok) {
      const data = await check.json();
      if (!data.trashed && data.id) {
        return { folderId: data.id, folderName: data.name || DRIVE_FOLDER_NAME };
      }
    }
  }

  const q = encodeURIComponent(
    `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchRes = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`
  );
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (Array.isArray(searchData.files) && searchData.files.length > 0) {
      return {
        folderId: searchData.files[0].id,
        folderName: searchData.files[0].name,
      };
    }
  }

  const createRes = await driveFetch(
    accessToken,
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Gagal membuat folder Google Drive: ${errText}`);
  }
  const created = await createRes.json();
  return { folderId: created.id, folderName: created.name };
}

function countPartCorrect(s: SubmissionRecord, prefix: string): number {
  let c = 0;
  for (const q of ALL_MCQ_QUESTIONS) {
    if (q.id.startsWith(prefix) && s.answers[q.id] === q.correctOption) {
      c += 1;
    }
  }
  return c;
}

function buildSpreadsheetData(submissions: SubmissionRecord[]) {
  const sorted = [...submissions].sort((a, b) => {
    if (a.kelas !== b.kelas) return a.kelas.localeCompare(b.kelas);
    return a.absen - b.absen;
  });

  // Tab 1: Rekap Nilai & Identitas (ringkas & mudah dibaca guru)
  const nilaiHeaders = [
    'No',
    'Kelas',
    'Absen',
    'Nama Lengkap',
    'Email Google Siswa',
    'Status Pengerjaan',
    'Skor PG (Benar)',
    'Total Soal PG',
    'Nilai PG (%)',
    'PG Bagian 1 (A-C /15)',
    'PG Bagian 2 (D-E /10)',
    'PG Bagian 3 (F-G /10)',
    'Waktu Kirim',
    'Terakhir Diperbarui',
  ];

  const nilaiRows = sorted.map((s, idx) => {
    const b1 =
      countPartCorrect(s, 'A') + countPartCorrect(s, 'B') + countPartCorrect(s, 'C');
    const b2 = countPartCorrect(s, 'D') + countPartCorrect(s, 'E');
    const b3 = countPartCorrect(s, 'F') + countPartCorrect(s, 'G');
    return [
      idx + 1,
      s.kelas,
      s.absen,
      s.nama,
      s.email,
      'Sudah Mengerjakan',
      s.skorPg,
      s.totalPg,
      s.persentasePg,
      b1,
      b2,
      b3,
      new Date(s.submittedAt).toLocaleString('id-ID'),
      new Date(s.updatedAt).toLocaleString('id-ID'),
    ];
  });

  // Tab 2: Detail Pertanyaan & Jawaban (lengkap seluruh 54 pertanyaan & jawaban)
  const detailHeaders = [
    'No',
    'Kelas',
    'Absen',
    'Nama Lengkap',
    'Email Google Siswa',
    'Nilai PG (%)',
    'Waktu Kirim',
    ...ALL_QUESTIONS.map((q) => `[${q.id}] ${q.prompt}`),
  ];

  const detailRows = sorted.map((s, idx) => [
    idx + 1,
    s.kelas,
    s.absen,
    s.nama,
    s.email,
    s.persentasePg,
    new Date(s.submittedAt).toLocaleString('id-ID'),
    ...ALL_QUESTIONS.map((q) => {
      const ans = s.answers[q.id] || '';
      if (q.type === 'mcq' && ans in q.options) {
        return `${ans}. ${q.options[ans as keyof typeof q.options]}`;
      }
      return ans;
    }),
  ]);

  // Tab 3: Ringkasan Per Kelas (71-95)
  const summaryHeaders = [
    'Kelas',
    'Jumlah Siswa Selesai',
    'Rata-rata Skor PG',
    'Rata-rata Nilai PG (%)',
    'Nilai Tertinggi (%)',
    'Nilai Terendah (%)',
  ];

  const summaryRows = ALL_CLASSES.map((cls) => {
    const list = sorted.filter((s) => s.kelas === cls);
    const count = list.length;
    if (count === 0) {
      return [cls, 0, 0, 0, 0, 0];
    }
    const avgScore = Number(
      (list.reduce((acc, s) => acc + s.skorPg, 0) / count).toFixed(1)
    );
    const avgPct = Number(
      (list.reduce((acc, s) => acc + s.persentasePg, 0) / count).toFixed(1)
    );
    const maxPct = Math.max(...list.map((s) => s.persentasePg));
    const minPct = Math.min(...list.map((s) => s.persentasePg));
    return [cls, count, avgScore, avgPct, maxPct, minPct];
  });

  return {
    nilaiValues: [nilaiHeaders, ...nilaiRows],
    detailValues: [detailHeaders, ...detailRows],
    summaryValues: [summaryHeaders, ...summaryRows],
  };
}

function buildCsvString(submissions: SubmissionRecord[]): string {
  const esc = (v: string | number) =>
    `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const headers = [
    'Kelas',
    'Absen',
    'Nama Lengkap',
    'Email Google',
    'Skor PG',
    'Total PG',
    'Nilai PG (%)',
    'Waktu Kirim',
    ...ALL_QUESTIONS.map((q) => `[${q.id}] ${q.prompt}`),
  ];
  const sorted = [...submissions].sort((a, b) =>
    a.kelas !== b.kelas ? a.kelas.localeCompare(b.kelas) : a.absen - b.absen
  );
  const rows = sorted.map((s) => [
    esc(s.kelas),
    esc(s.absen),
    esc(s.nama),
    esc(s.email),
    esc(s.skorPg),
    esc(s.totalPg),
    esc(s.persentasePg),
    esc(new Date(s.submittedAt).toLocaleString('id-ID')),
    ...ALL_QUESTIONS.map((q) => esc(s.answers[q.id] || '')),
  ]);
  return '\uFEFF' + [headers.map(esc).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

async function upsertDriveTextFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  mimeType: string,
  content: string
): Promise<void> {
  const q = encodeURIComponent(
    `name = '${fileName}' and '${folderId}' in parents and trashed = false`
  );
  const searchRes = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`
  );
  let existingFileId: string | null = null;
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (Array.isArray(searchData.files) && searchData.files.length > 0) {
      existingFileId = searchData.files[0].id;
    }
  }

  if (existingFileId) {
    await driveFetch(
      accessToken,
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': mimeType },
        body: content,
      }
    );
  } else {
    const boundary = 'refleksi_kokurikuler_boundary_v2';
    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
      mimeType,
    });
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;

    await driveFetch(
      accessToken,
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );
  }
}

export async function syncSubmissionsToGoogleWorkspace(
  accessToken: string,
  submissions: SubmissionRecord[],
  existing?: { folderId?: string; spreadsheetId?: string }
): Promise<{
  folderId: string;
  folderName: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
}> {
  const { folderId, folderName } = await ensureDriveFolder(
    accessToken,
    existing?.folderId
  );

  let spreadsheetId = existing?.spreadsheetId || '';
  let spreadsheetUrl = '';
  let sheetTabs: Array<{ id: number; title: string }> = [];

  const desiredTabNames = ['Rekap Nilai', 'Detail Jawaban', 'Ringkasan Kelas'];

  if (spreadsheetId) {
    const metaRes = await driveFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,spreadsheetUrl,sheets.properties(sheetId,title)`
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      spreadsheetUrl = meta.spreadsheetUrl;
      sheetTabs = (meta.sheets || []).map(
        (s: { properties?: { sheetId?: number; title?: string } }) => ({
          id: s.properties?.sheetId ?? 0,
          title: s.properties?.title || '',
        })
      );
    } else {
      spreadsheetId = '';
    }
  }

  // Also search in folder if spreadsheetId is not known locally
  if (!spreadsheetId) {
    const q = encodeURIComponent(
      `name = '${SPREADSHEET_TITLE}' and '${folderId}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
    );
    const searchRes = await driveFetch(
      accessToken,
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`
    );
    if (searchRes.ok) {
      const sd = await searchRes.json();
      if (Array.isArray(sd.files) && sd.files.length > 0) {
        const foundId = sd.files[0].id;
        const metaRes = await driveFetch(
          accessToken,
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(foundId)}?fields=spreadsheetId,spreadsheetUrl,sheets.properties(sheetId,title)`
        );
        if (metaRes.ok) {
          const meta = await metaRes.json();
          spreadsheetId = meta.spreadsheetId;
          spreadsheetUrl = meta.spreadsheetUrl;
          sheetTabs = (meta.sheets || []).map(
            (s: { properties?: { sheetId?: number; title?: string } }) => ({
              id: s.properties?.sheetId ?? 0,
              title: s.properties?.title || '',
            })
          );
        }
      }
    }
  }

  if (!spreadsheetId) {
    const createRes = await driveFetch(
      accessToken,
      'https://sheets.googleapis.com/v4/spreadsheets',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: { title: SPREADSHEET_TITLE },
          sheets: desiredTabNames.map((title) => ({ properties: { title } })),
        }),
      }
    );
    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Gagal membuat Google Spreadsheet: ${errText}`);
    }
    const created = await createRes.json();
    spreadsheetId = created.spreadsheetId;
    spreadsheetUrl = created.spreadsheetUrl;
    sheetTabs = (created.sheets || []).map(
      (s: { properties?: { sheetId?: number; title?: string } }) => ({
        id: s.properties?.sheetId ?? 0,
        title: s.properties?.title || '',
      })
    );

    // Move spreadsheet into target folder in Google Drive
    const fileInfoRes = await driveFetch(
      accessToken,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?fields=parents`
    );
    let removeParentsParam = '';
    if (fileInfoRes.ok) {
      const info = await fileInfoRes.json();
      if (Array.isArray(info.parents) && info.parents.length > 0) {
        removeParentsParam = `&removeParents=${encodeURIComponent(info.parents.join(','))}`;
      }
    }
    await driveFetch(
      accessToken,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?addParents=${encodeURIComponent(folderId)}${removeParentsParam}`,
      { method: 'PATCH' }
    );
  } else {
    // Ensure all 3 desired tabs exist
    const existingTitles = new Set(sheetTabs.map((t) => t.title));
    const missingTabs = desiredTabNames.filter((name) => !existingTitles.has(name));
    if (missingTabs.length > 0) {
      const addRes = await driveFetch(
        accessToken,
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: missingTabs.map((title) => ({
              addSheet: { properties: { title } },
            })),
          }),
        }
      );
      if (addRes.ok) {
        const metaRes = await driveFetch(
          accessToken,
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties(sheetId,title)`
        );
        if (metaRes.ok) {
          const meta = await metaRes.json();
          sheetTabs = (meta.sheets || []).map(
            (s: { properties?: { sheetId?: number; title?: string } }) => ({
              id: s.properties?.sheetId ?? 0,
              title: s.properties?.title || '',
            })
          );
        }
      }
    }
  }

  const nilaiTab = sheetTabs.find((t) => t.title === 'Rekap Nilai') || sheetTabs[0];
  const detailTab =
    sheetTabs.find((t) => t.title === 'Detail Jawaban') ||
    sheetTabs.find((t) => t.title === 'Semua Jawaban') ||
    sheetTabs[1] ||
    nilaiTab;
  const summaryTab =
    sheetTabs.find((t) => t.title === 'Ringkasan Kelas') || sheetTabs[2] || detailTab;

  const { nilaiValues, detailValues, summaryValues } = buildSpreadsheetData(submissions);

  await driveFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ranges: [
          `'${nilaiTab.title}'!A1:Z5000`,
          `'${detailTab.title}'!A1:ZZ5000`,
          `'${summaryTab.title}'!A1:Z100`,
        ],
      }),
    }
  );

  const writeRes = await driveFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'${nilaiTab.title}'!A1`, values: nilaiValues },
          { range: `'${detailTab.title}'!A1`, values: detailValues },
          { range: `'${summaryTab.title}'!A1`, values: summaryValues },
        ],
      }),
    }
  );

  if (!writeRes.ok) {
    const errText = await writeRes.text();
    throw new Error(`Gagal menulis data ke Google Spreadsheet: ${errText}`);
  }

  // Format header rows cleanly (bold, soft emerald tint, freeze top row)
  const uniqueSheetIds = Array.from(
    new Set([nilaiTab.id, detailTab.id, summaryTab.id])
  );
  await driveFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: uniqueSheetIds.flatMap((sheetId) => [
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.925, green: 0.992, blue: 0.961 },
                  textFormat: { bold: true },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
        ]),
      }),
    }
  );

  // Save complete JSON & CSV backups in the same Google Drive folder
  const backupJson = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      school: 'SMP Kemala Bhayangkari 7 Porong',
      totalSubmissions: submissions.length,
      questions: ALL_QUESTIONS.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        correctOption: q.type === 'mcq' ? q.correctOption : null,
      })),
      submissions,
    },
    null,
    2
  );

  await upsertDriveTextFile(
    accessToken,
    folderId,
    BACKUP_JSON_NAME,
    'application/json',
    backupJson
  );

  await upsertDriveTextFile(
    accessToken,
    folderId,
    BACKUP_CSV_NAME,
    'text/csv',
    buildCsvString(submissions)
  );

  return {
    folderId,
    folderName,
    spreadsheetId,
    spreadsheetUrl,
  };
}

export async function pullSubmissionsFromGoogleDrive(
  accessToken: string,
  existing?: { folderId?: string; spreadsheetId?: string }
): Promise<{
  submissions: SubmissionRecord[];
  folderId: string;
  folderName: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  pulledAt: string;
}> {
  const { folderId, folderName } = await ensureDriveFolder(
    accessToken,
    existing?.folderId
  );

  // 1. Try reading structured JSON backup file in the Drive folder
  const qBackup = encodeURIComponent(
    `name = '${BACKUP_JSON_NAME}' and '${folderId}' in parents and trashed = false`
  );
  const searchJsonRes = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?q=${qBackup}&fields=files(id,name)`
  );

  let submissions: SubmissionRecord[] = [];
  if (searchJsonRes.ok) {
    const jsonData = await searchJsonRes.json();
    if (Array.isArray(jsonData.files) && jsonData.files.length > 0) {
      const fileId = jsonData.files[0].id;
      const contentRes = await driveFetch(
        accessToken,
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
      );
      if (contentRes.ok) {
        const parsed = await contentRes.json();
        if (Array.isArray(parsed?.submissions)) {
          submissions = parsed.submissions;
        }
      }
    }
  }

  // 2. Locate Spreadsheet in folder to return metadata (and fallback read if JSON backup missing)
  let spreadsheetId = existing?.spreadsheetId || '';
  let spreadsheetUrl = '';
  if (!spreadsheetId) {
    const qSheet = encodeURIComponent(
      `name = '${SPREADSHEET_TITLE}' and '${folderId}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
    );
    const sheetSearchRes = await driveFetch(
      accessToken,
      `https://www.googleapis.com/drive/v3/files?q=${qSheet}&fields=files(id)`
    );
    if (sheetSearchRes.ok) {
      const sd = await sheetSearchRes.json();
      if (Array.isArray(sd.files) && sd.files.length > 0) {
        spreadsheetId = sd.files[0].id;
      }
    }
  }

  if (spreadsheetId) {
    const metaRes = await driveFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetUrl,sheets.properties.title`
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      spreadsheetUrl = meta.spreadsheetUrl || '';

      // If JSON backup wasn't found, reconstruct submissions from Detail Jawaban sheet
      if (submissions.length === 0) {
        const titles: string[] = (meta.sheets || []).map(
          (s: { properties?: { title?: string } }) => s.properties?.title || ''
        );
        const targetTab =
          titles.find((t) => t === 'Detail Jawaban') ||
          titles.find((t) => t === 'Semua Jawaban') ||
          titles[0];
        if (targetTab) {
          const valRes = await driveFetch(
            accessToken,
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`'${targetTab}'!A1:ZZ5000`)}`
          );
          if (valRes.ok) {
            const valData = await valRes.json();
            const rows: string[][] = Array.isArray(valData.values) ? valData.values : [];
            if (rows.length > 1) {
              const headerRow = rows[0];
              submissions = rows.slice(1).map((r, idx) => {
                const answers: Record<string, string> = {};
                ALL_QUESTIONS.forEach((q) => {
                  const colIdx = headerRow.findIndex((h) => h.startsWith(`[${q.id}]`));
                  const rawCell = colIdx >= 0 ? String(r[colIdx] || '') : '';
                  if (q.type === 'mcq' && /^[A-D]\.\s/.test(rawCell)) {
                    answers[q.id] = rawCell.charAt(0);
                  } else {
                    answers[q.id] = rawCell;
                  }
                });
                let skorPg = 0;
                for (const q of ALL_MCQ_QUESTIONS) {
                  if (answers[q.id] === q.correctOption) skorPg += 1;
                }
                const totalPg = ALL_MCQ_QUESTIONS.length;
                const persentasePg = Math.round((skorPg / totalPg) * 100);
                return {
                  id: `drive-${r[1] || 'x'}-${r[2] || idx}`,
                  uid: `drive-${r[1] || 'x'}-${r[2] || idx}`,
                  kelas: String(r[1] || ''),
                  absen: Number(r[2] || 0),
                  nama: String(r[3] || ''),
                  email: String(r[4] || ''),
                  answers,
                  skorPg,
                  totalPg,
                  persentasePg,
                  submittedAt: String(r[6] || new Date().toISOString()),
                  updatedAt: String(r[6] || new Date().toISOString()),
                };
              });
            }
          }
        }
      }
    }
  }

  return {
    submissions,
    folderId,
    folderName,
    spreadsheetId,
    spreadsheetUrl,
    pulledAt: new Date().toISOString(),
  };
}
