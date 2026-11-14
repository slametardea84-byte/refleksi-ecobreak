import {
  ALL_CLASSES,
  ALL_MCQ_QUESTIONS,
  ALL_QUESTIONS,
  REFLECTION_PARTS,
} from '../data/questions';
import type { SubmissionRecord } from '../types';

export const DRIVE_FOLDER_NAME = 'Refleksi Kokurikuler SMP Kemala Bhayangkari 7 Porong';
export const SPREADSHEET_TITLE = 'Rekap Refleksi Kokurikuler (Kelas 71-95)';
const BACKUP_JSON_NAME = 'backup-refleksi-kokurikuler.json';
const BACKUP_CSV_NAME = 'rekap-refleksi-kokurikuler.csv';

const TAB_REKAP = 'Rekap Status & Nilai';
const TAB_BAG1 = 'Bagian 1 - Karakter';
const TAB_BAG2 = 'Bagian 2 - Ecobrick';
const TAB_BAG3 = 'Bagian 3 - Karya';
const TAB_AKHIR = 'Refleksi Akhir Diri';
const TAB_SUMMARY = 'Ringkasan Kelas';

const DESIRED_TABS = [
  TAB_REKAP,
  TAB_BAG1,
  TAB_BAG2,
  TAB_BAG3,
  TAB_AKHIR,
  TAB_SUMMARY,
];

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

function countPartCorrect(s: SubmissionRecord, prefixes: string[]): number {
  let c = 0;
  for (const q of ALL_MCQ_QUESTIONS) {
    if (prefixes.some((p) => q.id.startsWith(p)) && s.answers[q.id] === q.correctOption) {
      c += 1;
    }
  }
  return c;
}

function getPartQuestions(partId: string) {
  const part = REFLECTION_PARTS.find((p) => p.id === partId);
  return part ? part.subSections.flatMap((s) => s.questions) : [];
}

function formatAnswerCell(
  q: (typeof ALL_QUESTIONS)[number],
  rawAns: string | undefined
): string {
  const ans = (rawAns || '').trim();
  if (!ans) return '';
  if (q.type === 'mcq' && ans in q.options) {
    return `${ans}. ${q.options[ans as keyof typeof q.options]}`;
  }
  return ans;
}

function hasCompletedPart(s: SubmissionRecord, partId: string): boolean {
  if (Array.isArray(s.completedParts) && s.completedParts.includes(partId)) {
    return true;
  }
  const qs = getPartQuestions(partId);
  return qs.length > 0 && qs.every((q) => Boolean((s.answers[q.id] || '').trim()));
}

function buildStructuredSheetData(
  submissions: SubmissionRecord[]
): Record<string, (string | number)[][]> {
  const sorted = [...submissions].sort((a, b) => {
    if (a.kelas !== b.kelas) return a.kelas.localeCompare(b.kelas);
    return a.absen - b.absen;
  });

  // 1. Rekap Status & Nilai
  const rekapHeaders = [
    'No',
    'Kelas',
    'Absen',
    'Nama Siswa',
    'Status Bagian 1',
    'Status Bagian 2',
    'Status Bagian 3',
    'Status Refleksi Mandiri',
    'PG Bagian 1 (/15)',
    'PG Bagian 2 (/10)',
    'PG Bagian 3 (/10)',
    'Total Skor PG (/35)',
    'Nilai PG (%)',
    'Terakhir Diperbarui',
  ];

  const rekapRows = sorted.map((s, idx) => {
    const b1 = countPartCorrect(s, ['A', 'B', 'C']);
    const b2 = countPartCorrect(s, ['D', 'E']);
    const b3 = countPartCorrect(s, ['F', 'G']);
    return [
      idx + 1,
      s.kelas,
      s.absen,
      s.nama,
      hasCompletedPart(s, 'bagian-1') ? 'Selesai' : 'Belum',
      hasCompletedPart(s, 'bagian-2') ? 'Selesai' : 'Belum',
      hasCompletedPart(s, 'bagian-3') ? 'Selesai' : 'Belum',
      hasCompletedPart(s, 'refleksi-akhir') ? 'Selesai' : 'Belum',
      b1,
      b2,
      b3,
      s.skorPg,
      s.persentasePg,
      new Date(s.updatedAt).toLocaleString('id-ID'),
    ];
  });

  // Helper to build per-part sheet
  const buildPartSheet = (partId: string, scoreLabel?: string, scoreFn?: (s: SubmissionRecord) => number) => {
    const qs = getPartQuestions(partId);
    const headers = [
      'Kelas',
      'Absen',
      'Nama Siswa',
      'Status Bagian',
      ...(scoreLabel ? [scoreLabel] : []),
      ...qs.map((q) => `[${q.id}] ${q.prompt}`),
      'Waktu Update',
    ];
    const rows = sorted.map((s) => [
      s.kelas,
      s.absen,
      s.nama,
      hasCompletedPart(s, partId) ? 'Selesai' : 'Belum',
      ...(scoreFn ? [scoreFn(s)] : []),
      ...qs.map((q) => formatAnswerCell(q, s.answers[q.id])),
      new Date(s.updatedAt).toLocaleString('id-ID'),
    ]);
    return [headers, ...rows];
  };

  const bag1Values = buildPartSheet('bagian-1', 'Skor PG (/15)', (s) =>
    countPartCorrect(s, ['A', 'B', 'C'])
  );
  const bag2Values = buildPartSheet('bagian-2', 'Skor PG (/10)', (s) =>
    countPartCorrect(s, ['D', 'E'])
  );
  const bag3Values = buildPartSheet('bagian-3', 'Skor PG (/10)', (s) =>
    countPartCorrect(s, ['F', 'G'])
  );
  const akhirValues = buildPartSheet('refleksi-akhir');

  // 6. Ringkasan Kelas
  const summaryHeaders = [
    'Kelas',
    'Selesai Bagian 1',
    'Selesai Bagian 2',
    'Selesai Bagian 3',
    'Selesai Refleksi Akhir',
    'Rata-rata Skor PG (/35)',
    'Rata-rata Nilai PG (%)',
  ];

  const summaryRows = ALL_CLASSES.map((cls) => {
    const list = sorted.filter((s) => s.kelas === cls);
    const count = list.length;
    if (count === 0) {
      return [cls, 0, 0, 0, 0, 0, 0];
    }
    const c1 = list.filter((s) => hasCompletedPart(s, 'bagian-1')).length;
    const c2 = list.filter((s) => hasCompletedPart(s, 'bagian-2')).length;
    const c3 = list.filter((s) => hasCompletedPart(s, 'bagian-3')).length;
    const c4 = list.filter((s) => hasCompletedPart(s, 'refleksi-akhir')).length;
    const avgScore = Number(
      (list.reduce((acc, s) => acc + s.skorPg, 0) / count).toFixed(1)
    );
    const avgPct = Number(
      (list.reduce((acc, s) => acc + s.persentasePg, 0) / count).toFixed(1)
    );
    return [cls, c1, c2, c3, c4, avgScore, avgPct];
  });

  return {
    [TAB_REKAP]: [rekapHeaders, ...rekapRows],
    [TAB_BAG1]: bag1Values,
    [TAB_BAG2]: bag2Values,
    [TAB_BAG3]: bag3Values,
    [TAB_AKHIR]: akhirValues,
    [TAB_SUMMARY]: [summaryHeaders, ...summaryRows],
  };
}

function buildCsvString(submissions: SubmissionRecord[]): string {
  const esc = (v: string | number) =>
    `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const headers = [
    'Kelas',
    'Absen',
    'Nama Siswa',
    'Bagian 1',
    'Bagian 2',
    'Bagian 3',
    'Refleksi Akhir',
    'Skor PG',
    'Total PG',
    'Nilai PG (%)',
    'Terakhir Diperbarui',
    ...ALL_QUESTIONS.map((q) => `[${q.id}] ${q.prompt}`),
  ];
  const sorted = [...submissions].sort((a, b) =>
    a.kelas !== b.kelas ? a.kelas.localeCompare(b.kelas) : a.absen - b.absen
  );
  const rows = sorted.map((s) => [
    esc(s.kelas),
    esc(s.absen),
    esc(s.nama),
    esc(hasCompletedPart(s, 'bagian-1') ? 'Selesai' : 'Belum'),
    esc(hasCompletedPart(s, 'bagian-2') ? 'Selesai' : 'Belum'),
    esc(hasCompletedPart(s, 'bagian-3') ? 'Selesai' : 'Belum'),
    esc(hasCompletedPart(s, 'refleksi-akhir') ? 'Selesai' : 'Belum'),
    esc(s.skorPg),
    esc(s.totalPg),
    esc(s.persentasePg),
    esc(new Date(s.updatedAt).toLocaleString('id-ID')),
    ...ALL_QUESTIONS.map((q) => esc(formatAnswerCell(q, s.answers[q.id]))),
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
    const boundary = 'refleksi_kokurikuler_boundary_v3';
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
          sheets: DESIRED_TABS.map((title) => ({ properties: { title } })),
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
    const existingTitles = new Set(sheetTabs.map((t) => t.title));
    const missingTabs = DESIRED_TABS.filter((name) => !existingTitles.has(name));
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

  const sheetDataMap = buildStructuredSheetData(submissions);

  await driveFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ranges: DESIRED_TABS.map((t) => `'${t}'!A1:ZZ5000`),
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
        data: DESIRED_TABS.map((t) => ({
          range: `'${t}'!A1`,
          values: sheetDataMap[t],
        })),
      }),
    }
  );

  if (!writeRes.ok) {
    const errText = await writeRes.text();
    throw new Error(`Gagal menulis data ke Google Spreadsheet: ${errText}`);
  }

  const targetSheetIds = sheetTabs
    .filter((t) => DESIRED_TABS.includes(t.title))
    .map((t) => t.id);

  if (targetSheetIds.length > 0) {
    await driveFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: targetSheetIds.flatMap((sheetId) => [
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
  }

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

      // If JSON backup is empty/missing, reconstruct from the structured per-part tabs
      if (submissions.length === 0) {
        const titles: string[] = (meta.sheets || []).map(
          (s: { properties?: { title?: string } }) => s.properties?.title || ''
        );
        const partTabPairs: Array<{ tab: string; partId: string }> = [
          { tab: TAB_BAG1, partId: 'bagian-1' },
          { tab: TAB_BAG2, partId: 'bagian-2' },
          { tab: TAB_BAG3, partId: 'bagian-3' },
          { tab: TAB_AKHIR, partId: 'refleksi-akhir' },
        ];
        const mapByKey = new Map<string, SubmissionRecord>();
        for (const { tab, partId } of partTabPairs) {
          if (!titles.includes(tab)) continue;
          const valRes = await driveFetch(
            accessToken,
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`'${tab}'!A1:ZZ5000`)}`
          );
          if (!valRes.ok) continue;
          const valData = await valRes.json();
          const rows: string[][] = Array.isArray(valData.values) ? valData.values : [];
          if (rows.length < 2) continue;
          const headers = rows[0];
          const qs = getPartQuestions(partId);
          for (const r of rows.slice(1)) {
            const kelas = String(r[0] || '');
            const absen = Number(r[1] || 0);
            const nama = String(r[2] || '');
            const status = String(r[3] || '');
            if (!kelas || !absen) continue;
            const key = `${kelas}-${String(absen).padStart(2, '0')}`;
            const rec = mapByKey.get(key) || {
              id: key,
              uid: key,
              email: '',
              nama,
              kelas,
              absen,
              answers: {},
              completedParts: [],
              skorPg: 0,
              totalPg: ALL_MCQ_QUESTIONS.length,
              persentasePg: 0,
              submittedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            if (status === 'Selesai' && !rec.completedParts.includes(partId)) {
              rec.completedParts.push(partId);
            }
            for (const q of qs) {
              const colIdx = headers.findIndex((h) => h.startsWith(`[${q.id}]`));
              const rawCell = colIdx >= 0 ? String(r[colIdx] || '') : '';
              if (rawCell) {
                rec.answers[q.id] =
                  q.type === 'mcq' && /^[A-D]\.\s/.test(rawCell)
                    ? rawCell.charAt(0)
                    : rawCell;
              }
            }
            mapByKey.set(key, rec);
          }
        }
        submissions = Array.from(mapByKey.values()).map((rec) => {
          let skorPg = 0;
          for (const q of ALL_MCQ_QUESTIONS) {
            if (rec.answers[q.id] === q.correctOption) skorPg += 1;
          }
          return {
            ...rec,
            skorPg,
            persentasePg: Math.round((skorPg / ALL_MCQ_QUESTIONS.length) * 100),
          };
        });
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
