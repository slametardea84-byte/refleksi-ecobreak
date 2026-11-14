import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CloudDownload,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FolderOpen,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  ALL_CLASSES,
  ALL_QUESTIONS,
  REFLECTION_PARTS,
  type OptionKey,
} from '../data/questions';
import {
  clearWorkspaceAccessToken,
  deleteSubmissionById,
  getDriveSyncSettings,
  getWorkspaceAccessToken,
  saveDriveSyncSettings,
  subscribeAllSubmissions,
  TEACHER_EMAIL,
  teacherGoogleSignIn,
} from '../lib/firebase';
import {
  pullSubmissionsFromGoogleDrive,
  syncSubmissionsToGoogleWorkspace,
} from '../lib/googleWorkspace';
import type { DriveSyncSettings, SubmissionRecord } from '../types';

interface TeacherDashboardModalProps {
  googleUser: User | null;
  onClose: () => void;
}

const OFFLINE_CACHE_KEY = 'teacher_refleksi_offline_cache_v1';

interface OfflineCachePayload {
  savedAt: string;
  source: 'firestore' | 'drive';
  submissions: SubmissionRecord[];
}

const APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetNilai = ss.getSheetByName('Rekap Nilai') || ss.getSheets()[0];
  if (sheetNilai.getLastRow() === 0) {
    sheetNilai.appendRow(['Waktu Kirim', 'Kelas', 'Absen', 'Nama Lengkap', 'Email Google', 'Skor PG', 'Total PG', 'Nilai PG (%)']);
  }
  sheetNilai.appendRow([
    new Date(data.submittedAt).toLocaleString('id-ID'),
    data.kelas,
    data.absen,
    data.nama,
    data.email,
    data.skorPg,
    data.totalPg,
    data.persentasePg
  ]);

  var sheetDetail = ss.getSheetByName('Detail Jawaban') || ss.insertSheet('Detail Jawaban');
  var qa = data.questionsAndAnswers || [];
  if (sheetDetail.getLastRow() === 0) {
    var headers = ['Waktu Kirim', 'Kelas', 'Absen', 'Nama Lengkap', 'Email Google', 'Nilai PG (%)'];
    for (var i = 0; i < qa.length; i++) {
      headers.push('[' + qa[i].id + '] ' + qa[i].prompt);
    }
    sheetDetail.appendRow(headers);
  }
  var row = [new Date(data.submittedAt).toLocaleString('id-ID'), data.kelas, data.absen, data.nama, data.email, data.persentasePg];
  for (var j = 0; j < qa.length; j++) {
    row.push(qa[j].answer || '');
  }
  sheetDetail.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}`;

const GoogleLogoSvg = () => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    style={{ display: 'block' }}
  >
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
    <path fill="none" d="M0 0h48v48H0z" />
  </svg>
);

function csvEscape(value: string | number): string {
  const str = String(value ?? '');
  const escaped = str.replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return `"${escaped}"`;
}

function readOfflineCache(): OfflineCachePayload | null {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineCachePayload;
    if (Array.isArray(parsed?.submissions)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeOfflineCache(
  submissions: SubmissionRecord[],
  source: 'firestore' | 'drive'
): OfflineCachePayload {
  const payload: OfflineCachePayload = {
    savedAt: new Date().toISOString(),
    source,
    submissions,
  };
  try {
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
  return payload;
}

export const TeacherDashboardModal: React.FC<TeacherDashboardModalProps> = ({
  googleUser,
  onClose,
}) => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineModeView, setOfflineModeView] = useState(false);
  const [offlineCache, setOfflineCache] = useState<OfflineCachePayload | null>(() =>
    readOfflineCache()
  );

  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState('');

  const [firestoreSubmissions, setFirestoreSubmissions] = useState<SubmissionRecord[]>([]);
  const [drivePulledSubmissions, setDrivePulledSubmissions] = useState<
    SubmissionRecord[] | null
  >(null);
  const [dataSourceLabel, setDataSourceLabel] = useState<
    'firestore' | 'drive' | 'offline-cache'
  >('firestore');

  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [kelasFilter, setKelasFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] =
    useState<SubmissionRecord | null>(null);

  const [syncSettings, setSyncSettings] = useState<DriveSyncSettings | null>(null);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [isPullingDrive, setIsPullingDrive] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [showWebhookPanel, setShowWebhookPanel] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const [confirmSyncModal, setConfirmSyncModal] = useState(false);
  const [confirmAutoSyncModal, setConfirmAutoSyncModal] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] =
    useState<SubmissionRecord | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const isTeacherAuthenticated =
    Boolean(googleUser?.emailVerified) &&
    googleUser?.email?.toLowerCase() === TEACHER_EMAIL.toLowerCase();

  // Active dataset displayed in table
  const activeSubmissions = useMemo(() => {
    if (offlineModeView && offlineCache) {
      return offlineCache.submissions;
    }
    if (dataSourceLabel === 'drive' && drivePulledSubmissions) {
      return drivePulledSubmissions;
    }
    if (!isOnline && firestoreSubmissions.length === 0 && offlineCache) {
      return offlineCache.submissions;
    }
    return firestoreSubmissions;
  }, [
    offlineModeView,
    offlineCache,
    dataSourceLabel,
    drivePulledSubmissions,
    isOnline,
    firestoreSubmissions,
  ]);

  // Subscribe to live Firestore submissions when authenticated as teacher
  useEffect(() => {
    if (!isTeacherAuthenticated) {
      setFirestoreSubmissions([]);
      return;
    }

    setIsLoadingSubmissions(true);
    const unsub = subscribeAllSubmissions(
      (list) => {
        setFirestoreSubmissions(list);
        setIsLoadingSubmissions(false);
        if (list.length > 0) {
          const cached = writeOfflineCache(list, 'firestore');
          setOfflineCache(cached);
        }
      },
      () => {
        setIsLoadingSubmissions(false);
        if (offlineCache) {
          setDataSourceLabel('offline-cache');
        } else {
          setAuthError('Gagal memuat data refleksi siswa dari Firestore.');
        }
      }
    );

    getDriveSyncSettings()
      .then((settings) => {
        if (settings) setSyncSettings(settings);
      })
      .catch(() => {
        // ignore if not yet created
      });

    const token = getWorkspaceAccessToken();
    if (token) {
      fetch('/api/teacher/webhook', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.ok && typeof d.appsScriptWebhookUrl === 'string') {
            setWebhookUrl(d.appsScriptWebhookUrl);
          }
        })
        .catch(() => {
          // ignore
        });
    }

    return () => unsub();
  }, [isTeacherAuthenticated]);

  const executeDriveSheetsSync = useCallback(
    async (recordsToSync: SubmissionRecord[]) => {
      setConfirmSyncModal(false);
      setSyncMessage(null);

      if (!googleUser || !isTeacherAuthenticated) return;

      setIsSyncingDrive(true);
      try {
        let token = getWorkspaceAccessToken();
        if (!token) {
          const res = await teacherGoogleSignIn();
          token = res.accessToken;
        }

        const result = await syncSubmissionsToGoogleWorkspace(token, recordsToSync, {
          folderId: syncSettings?.folderId,
          spreadsheetId: syncSettings?.spreadsheetId,
        });

        await saveDriveSyncSettings(googleUser.uid, {
          folderId: result.folderId,
          folderName: result.folderName,
          spreadsheetId: result.spreadsheetId,
          spreadsheetUrl: result.spreadsheetUrl,
          lastSyncedCount: recordsToSync.length,
        });

        const refreshed = await getDriveSyncSettings();
        if (refreshed) setSyncSettings(refreshed);

        const cached = writeOfflineCache(recordsToSync, 'drive');
        setOfflineCache(cached);

        setSyncMessage({
          type: 'success',
          text: `Berhasil menyimpan ${recordsToSync.length} data siswa (Rekap Nilai, Detail 54 Pertanyaan & Jawaban, Ringkasan Kelas, serta backup JSON & CSV) ke Google Drive Anda.`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('TOKEN_EXPIRED')) {
          clearWorkspaceAccessToken();
          setAutoSyncEnabled(false);
          setSyncMessage({
            type: 'error',
            text: 'Sesi izin Google Drive berakhir. Klik tombol Sinkronkan lagi untuk memperbarui akses.',
          });
        } else {
          setSyncMessage({
            type: 'error',
            text: msg || 'Gagal menyinkronkan ke Google Spreadsheet & Drive.',
          });
        }
      } finally {
        setIsSyncingDrive(false);
      }
    },
    [googleUser, isTeacherAuthenticated, syncSettings]
  );

  // Auto-sync whenever enabled by explicit confirmation and Firestore count changes
  useEffect(() => {
    if (
      autoSyncEnabled &&
      isTeacherAuthenticated &&
      isOnline &&
      firestoreSubmissions.length > 0 &&
      !isSyncingDrive &&
      syncSettings?.lastSyncedCount !== firestoreSubmissions.length
    ) {
      executeDriveSheetsSync(firestoreSubmissions);
    }
  }, [
    autoSyncEnabled,
    isTeacherAuthenticated,
    isOnline,
    firestoreSubmissions,
    isSyncingDrive,
    syncSettings,
    executeDriveSheetsSync,
  ]);

  const handleTeacherSignIn = async () => {
    setAuthError('');
    setIsAuthorizing(true);
    try {
      const { user, accessToken } = await teacherGoogleSignIn();
      if (user.email?.toLowerCase() !== TEACHER_EMAIL.toLowerCase()) {
        setAuthError(
          `Akun ${user.email} bukan akun guru pengelola (${TEACHER_EMAIL}). Silakan masuk dengan akun guru.`
        );
        return;
      }
      setOfflineModeView(false);
      const webhookRes = await fetch('/api/teacher/webhook', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (webhookRes.ok) {
        const wd = await webhookRes.json();
        if (wd?.ok && typeof wd.appsScriptWebhookUrl === 'string') {
          setWebhookUrl(wd.appsScriptWebhookUrl);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(
          'Gagal terhubung ke Google Drive & Google Sheets. Pastikan pop-up dan izin akses diberikan.'
        );
      }
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handlePullFromDrive = async () => {
    setSyncMessage(null);
    setIsPullingDrive(true);
    try {
      let token = getWorkspaceAccessToken();
      if (!token) {
        const res = await teacherGoogleSignIn();
        token = res.accessToken;
      }

      const pulled = await pullSubmissionsFromGoogleDrive(token, {
        folderId: syncSettings?.folderId,
        spreadsheetId: syncSettings?.spreadsheetId,
      });

      if (pulled.submissions.length === 0) {
        setSyncMessage({
          type: 'error',
          text: 'Belum ditemukan data siswa di folder Google Drive. Silakan sinkronkan data ke Drive terlebih dahulu.',
        });
        return;
      }

      setDrivePulledSubmissions(pulled.submissions);
      setDataSourceLabel('drive');
      const cached = writeOfflineCache(pulled.submissions, 'drive');
      setOfflineCache(cached);

      if (googleUser && pulled.spreadsheetId) {
        await saveDriveSyncSettings(googleUser.uid, {
          folderId: pulled.folderId,
          folderName: pulled.folderName,
          spreadsheetId: pulled.spreadsheetId,
          spreadsheetUrl: pulled.spreadsheetUrl,
          lastSyncedCount: pulled.submissions.length,
        }).catch(() => {
          // non-blocking
        });
      }

      setSyncMessage({
        type: 'success',
        text: `Berhasil menarik ${pulled.submissions.length} data siswa dari Google Drive dan menyimpannya ke cache offline perangkat ini.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('TOKEN_EXPIRED')) {
        clearWorkspaceAccessToken();
        setSyncMessage({
          type: 'error',
          text: 'Sesi izin Google Drive berakhir. Klik "Tarik Data dari Drive" lagi untuk masuk ulang.',
        });
      } else {
        setSyncMessage({
          type: 'error',
          text: 'Gagal menarik data dari Google Drive. Menampilkan data cache lokal jika tersedia.',
        });
      }
    } finally {
      setIsPullingDrive(false);
    }
  };

  const handleRequestSync = () => {
    if (syncSettings?.spreadsheetId) {
      setConfirmSyncModal(true);
    } else {
      executeDriveSheetsSync(activeSubmissions);
    }
  };

  const handleToggleAutoSync = () => {
    if (autoSyncEnabled) {
      setAutoSyncEnabled(false);
    } else {
      setConfirmAutoSyncModal(true);
    }
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncMessage(null);
    setIsSavingWebhook(true);
    try {
      let token = getWorkspaceAccessToken();
      if (!token) {
        const res = await teacherGoogleSignIn();
        token = res.accessToken;
      }
      const res = await fetch('/api/teacher/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ appsScriptWebhookUrl: webhookUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSyncMessage({
          type: 'error',
          text: data.error || 'Gagal menyimpan URL Web App Apps Script.',
        });
        return;
      }
      setSyncMessage({
        type: 'success',
        text: webhookUrl.trim()
          ? 'URL Google Apps Script tersimpan. Setiap siswa yang mengirim refleksi akan otomatis diteruskan ke Spreadsheet Anda.'
          : 'URL Google Apps Script dinonaktifkan.',
      });
    } catch {
      setSyncMessage({
        type: 'error',
        text: 'Gagal menyimpan pengaturan webhook ke server.',
      });
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTarget) return;
    const target = confirmDeleteTarget;
    setConfirmDeleteTarget(null);
    await deleteSubmissionById(target.id);
    if (selectedSubmission?.id === target.id) {
      setSelectedSubmission(null);
    }
  };

  const filteredSubmissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeSubmissions.filter((s) => {
      if (kelasFilter !== 'all' && s.kelas !== kelasFilter) return false;
      if (
        q &&
        !s.nama.toLowerCase().includes(q) &&
        !s.email.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [activeSubmissions, kelasFilter, searchQuery]);

  const classCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cls of ALL_CLASSES) map[cls] = 0;
    for (const s of activeSubmissions) {
      map[s.kelas] = (map[s.kelas] || 0) + 1;
    }
    return map;
  }, [activeSubmissions]);

  const handleDownloadCsv = () => {
    const headers = [
      'Kelas',
      'No Absen',
      'Nama Siswa',
      'Email Google',
      'Skor PG',
      'Total PG',
      'Persentase PG (%)',
      'Waktu Kirim',
      ...ALL_QUESTIONS.map((q) => `[${q.id}] ${q.prompt}`),
    ];

    const rows = filteredSubmissions.map((s) => [
      csvEscape(s.kelas),
      csvEscape(s.absen),
      csvEscape(s.nama),
      csvEscape(s.email),
      csvEscape(s.skorPg),
      csvEscape(s.totalPg),
      csvEscape(s.persentasePg),
      csvEscape(new Date(s.submittedAt).toLocaleString('id-ID')),
      ...ALL_QUESTIONS.map((q) => csvEscape(s.answers[q.id] || '')),
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.map(csvEscape).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      kelasFilter === 'all'
        ? 'rekap-refleksi-semua-kelas.csv'
        : `rekap-refleksi-kelas-${kelasFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canShowDashboard = isTeacherAuthenticated || offlineModeView;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Portal Mode Guru"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Mode Guru — Rekap &amp; Penyimpanan Google Drive
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              SMP Kemala Bhayangkari 7 Porong · Tarik Data Drive &amp; Akses Cache Offline
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup mode guru"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!canShowDashboard ? (
          <div className="p-8 max-w-md mx-auto w-full space-y-5 my-8 text-center">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">
                Masuk dengan Akun Google Guru
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Masuk menggunakan akun <span className="font-semibold text-slate-900">{TEACHER_EMAIL}</span> untuk menyimpan seluruh jawaban &amp; nilai ke Google Spreadsheet / Drive, serta menarik data dari Drive untuk akses offline.
              </p>
            </div>

            {!isOnline && (
              <div className="flex items-start gap-2 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 text-left">
                <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Perangkat sedang offline. Anda tetap bisa membuka data cache terakhir yang pernah ditarik dari Google Drive.
                </span>
              </div>
            )}

            {googleUser && !isTeacherAuthenticated && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 text-left">
                Saat ini masuk sebagai <strong>{googleUser.email}</strong>. Silakan ganti ke akun guru <strong>{TEACHER_EMAIL}</strong>.
              </div>
            )}

            {authError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 text-left">
                {authError}
              </div>
            )}

            <button
              type="button"
              onClick={handleTeacherSignIn}
              disabled={isAuthorizing || !isOnline}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <GoogleLogoSvg />
                </div>
                <span className="gsi-material-button-contents">
                  {isAuthorizing ? 'Menghubungkan...' : 'Sign in with Google'}
                </span>
              </div>
            </button>

            {offlineCache && (
              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setOfflineModeView(true);
                    setDataSourceLabel('offline-cache');
                  }}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <WifiOff className="w-4 h-4" />
                  <span>
                    Buka Data Cache Offline ({offlineCache.submissions.length} siswa ·{' '}
                    {new Date(offlineCache.savedAt).toLocaleString('id-ID')})
                  </span>
                </button>
              </div>
            )}
          </div>
        ) : selectedSubmission ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedSubmission.nama}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedSubmission.email} · Kelas {selectedSubmission.kelas} · Absen{' '}
                  {selectedSubmission.absen} · Skor PG:{' '}
                  <span className="font-mono-tabular font-semibold text-emerald-700">
                    {selectedSubmission.skorPg}/{selectedSubmission.totalPg} (
                    {selectedSubmission.persentasePg}%)
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Kembali ke Daftar
              </button>
            </div>

            <div className="space-y-6">
              {REFLECTION_PARTS.map((part) => (
                <div key={part.id} className="space-y-3">
                  <h4 className="text-sm font-bold text-emerald-800 border-b border-slate-200 pb-1">
                    {part.title}
                  </h4>
                  {part.subSections.map((sub) => (
                    <div key={sub.id} className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500">{sub.title}</p>
                      {sub.questions.map((q) => {
                        const ans = selectedSubmission.answers[q.id] || '-';
                        const isCorrect = q.type === 'mcq' && ans === q.correctOption;
                        return (
                          <div
                            key={q.id}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                          >
                            <p className="font-medium text-slate-900">
                              {q.number}. {q.prompt}
                            </p>
                            <p className="mt-1 text-slate-700">
                              {q.type === 'mcq' && ans in q.options ? (
                                <span>
                                  <span className="font-semibold">
                                    {ans}. {q.options[ans as OptionKey]}
                                  </span>{' '}
                                  <span
                                    className={
                                      isCorrect
                                        ? 'text-emerald-700 text-xs font-semibold'
                                        : 'text-amber-700 text-xs font-semibold'
                                    }
                                  >
                                    ({isCorrect ? 'Benar' : `Kunci: ${q.correctOption}`})
                                  </span>
                                </span>
                              ) : (
                                ans
                              )}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Offline Status Banner */}
            {(!isOnline || offlineModeView) && (
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 shrink-0" />
                  <span>
                    Menampilkan <strong>Data Cache Offline</strong> (tersimpan{' '}
                    {offlineCache
                      ? new Date(offlineCache.savedAt).toLocaleString('id-ID')
                      : '-'}
                    ). Data tetap aman meski sistem offline.
                  </span>
                </div>
                {isOnline && offlineModeView && (
                  <button
                    type="button"
                    onClick={() => {
                      setOfflineModeView(false);
                      setDataSourceLabel('firestore');
                    }}
                    className="px-3 py-1 rounded-lg bg-white border border-amber-300 font-semibold cursor-pointer"
                  >
                    Masuk Online
                  </button>
                )}
              </div>
            )}

            {/* Google Drive & Google Sheets Sync Bar */}
            {isTeacherAuthenticated && (
              <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                      <span>Google Spreadsheet &amp; Backup Google Drive</span>
                      {syncSettings?.lastSyncedCount !== undefined && (
                        <span className="text-xs font-normal text-slate-500">
                          · Tersinkron {syncSettings.lastSyncedCount} siswa
                          {firestoreSubmissions.length > syncSettings.lastSyncedCount &&
                            ` (${firestoreSubmissions.length - syncSettings.lastSyncedCount} data baru menunggu)`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      Menyimpan rapi 3 tab Spreadsheet (<strong>Rekap Nilai</strong>,{' '}
                      <strong>Detail 54 Pertanyaan &amp; Jawaban</strong>,{' '}
                      <strong>Ringkasan Kelas</strong>) + cadangan JSON &amp; CSV di Drive Anda.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {syncSettings?.spreadsheetUrl && (
                      <a
                        href={syncSettings.spreadsheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Spreadsheet</span>
                      </a>
                    )}
                    {syncSettings?.folderId && (
                      <a
                        href={`https://drive.google.com/drive/folders/${syncSettings.folderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Buka Drive</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={handlePullFromDrive}
                      disabled={isPullingDrive || !isOnline}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white border border-emerald-600 text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <CloudDownload className="w-3.5 h-3.5" />
                      <span>
                        {isPullingDrive ? 'Menarik...' : 'Tarik Data dari Drive'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRequestSync}
                      disabled={isSyncingDrive || !isOnline}
                      className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {isSyncingDrive
                          ? 'Menyinkronkan...'
                          : syncSettings?.spreadsheetId
                            ? 'Sinkronkan ke Spreadsheet & Drive'
                            : 'Buat Spreadsheet & Simpan ke Drive'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Source Switcher + Auto-Sync & 24/7 Apps Script Controls */}
                <div className="pt-3 border-t border-emerald-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-slate-600 font-medium">Sumber Tampilan:</span>
                    <button
                      type="button"
                      onClick={() => setDataSourceLabel('firestore')}
                      className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                        dataSourceLabel === 'firestore'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-white border border-slate-200 text-slate-700'
                      }`}
                    >
                      Database Live ({firestoreSubmissions.length})
                    </button>
                    {drivePulledSubmissions && (
                      <button
                        type="button"
                        onClick={() => setDataSourceLabel('drive')}
                        className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                          dataSourceLabel === 'drive'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                      >
                        Hasil Tarikan Drive ({drivePulledSubmissions.length})
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleToggleAutoSync}
                      className={`px-3 py-1.5 rounded-lg border font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                        autoSyncEnabled
                          ? 'bg-emerald-700 border-emerald-700 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>
                        Auto-Sync Saat Terbuka: {autoSyncEnabled ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowWebhookPanel((p) => !p)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>Kirim Otomatis 24 Jam (Apps Script)</span>
                    </button>
                  </div>
                </div>

                {/* Optional 24/7 Apps Script Webhook Configuration */}
                {showWebhookPanel && (
                  <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 text-xs text-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-900">
                          Kirim Otomatis ke Spreadsheet Saat Siswa Selesai (Meski Mode Guru Ditutup)
                        </p>
                        <p className="text-slate-600 leading-relaxed">
                          Agar baris jawaban langsung masuk ke Google Spreadsheet detik itu juga meski perangkat Anda mati/offline: buka Spreadsheet Anda → menu <strong>Ekstensi → Apps Script</strong> → tempel kode di bawah → <strong>Terapkan (Deploy) → Aplikasi Web</strong> (Jalankan sebagai: <em>Saya</em>, Yang memiliki akses: <em>Siapa saja</em>) → tempel URL-nya di bawah.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyScript}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-800 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {copiedScript ? (
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedScript ? 'Tersalin' : 'Salin Skrip'}</span>
                      </button>
                    </div>

                    <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono-tabular text-[11px] overflow-x-auto max-h-40">
                      {APPS_SCRIPT_TEMPLATE}
                    </pre>

                    <form
                      onSubmit={handleSaveWebhook}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                    >
                      <input
                        type="url"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className="flex-1 min-h-[38px] px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                      />
                      <button
                        type="submit"
                        disabled={isSavingWebhook}
                        className="min-h-[38px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer shrink-0"
                      >
                        {isSavingWebhook ? 'Menyimpan...' : 'Simpan URL Otomatis'}
                      </button>
                    </form>
                  </div>
                )}

                {syncMessage && (
                  <div
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${
                      syncMessage.type === 'success'
                        ? 'bg-white border-emerald-200 text-emerald-900'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {syncMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <span>{syncMessage.text}</span>
                  </div>
                )}
              </div>
            )}

            {/* Summary Strip Across 13 Classes */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-4 border-b border-slate-200 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                Sudah Mengerjakan:{' '}
                <span className="font-mono-tabular text-emerald-700">
                  {activeSubmissions.length}
                </span>{' '}
                siswa
              </span>
              <span aria-hidden="true">·</span>
              {ALL_CLASSES.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setKelasFilter((prev) => (prev === cls ? 'all' : cls))}
                  className={`font-mono-tabular transition-colors cursor-pointer ${
                    kelasFilter === cls
                      ? 'text-emerald-700 font-bold underline underline-offset-4'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {cls}: {classCounts[cls]}
                </button>
              ))}
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama atau email siswa..."
                    className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  />
                </div>

                <select
                  value={kelasFilter}
                  onChange={(e) => setKelasFilter(e.target.value)}
                  className="min-h-[40px] px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                >
                  <option value="all">Semua Kelas (71–95)</option>
                  {ALL_CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      Kelas {cls}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleDownloadCsv}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh CSV (Excel)</span>
              </button>
            </div>

            {/* Submissions Table */}
            {isLoadingSubmissions && activeSubmissions.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                Memuat data refleksi siswa...
              </p>
            ) : filteredSubmissions.length === 0 ? (
              <div className="border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
                Belum ada jawaban refleksi siswa yang masuk untuk filter ini.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Kelas</th>
                      <th className="py-3 px-4">Absen</th>
                      <th className="py-3 px-4">Nama Siswa</th>
                      <th className="py-3 px-4">Akun Google</th>
                      <th className="py-3 px-4">Skor PG</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredSubmissions.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono-tabular font-semibold text-slate-900">
                          {item.kelas}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-slate-700">
                          {item.absen}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {item.nama}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {item.email}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-emerald-700 font-semibold">
                          {item.skorPg}/{item.totalPg} ({item.persentasePg}%)
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedSubmission(item)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </button>
                            {isTeacherAuthenticated && dataSourceLabel === 'firestore' && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteTarget(item)}
                                aria-label={`Hapus data ${item.nama}`}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog: Update Google Spreadsheet & Drive Backup */}
      {confirmSyncModal && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">
              Perbarui Google Spreadsheet &amp; Drive?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Isi Google Spreadsheet <strong>Rekap Refleksi Kokurikuler</strong> dan file cadangan JSON/CSV di Google Drive akan diperbarui dengan{' '}
              <strong className="font-mono-tabular">{activeSubmissions.length}</strong> data jawaban siswa terbaru.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSyncModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => executeDriveSheetsSync(activeSubmissions)}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-sm font-semibold text-white cursor-pointer"
              >
                Ya, Sinkronkan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Enable Auto-Sync */}
      {confirmAutoSyncModal && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">
              Aktifkan Sinkronisasi Otomatis?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Selama Mode Guru terbuka, setiap kali ada jawaban siswa baru yang masuk, aplikasi akan otomatis memperbarui isi Google Spreadsheet dan file cadangan di Google Drive Anda.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAutoSyncModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmAutoSyncModal(false);
                  setAutoSyncEnabled(true);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-sm font-semibold text-white cursor-pointer"
              >
                Aktifkan Auto-Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Student Submission */}
      {confirmDeleteTarget && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">
              Hapus Data Refleksi Siswa?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Data refleksi atas nama <strong>{confirmDeleteTarget.nama}</strong> (Kelas{' '}
              {confirmDeleteTarget.kelas}, Absen {confirmDeleteTarget.absen}) akan dihapus dari database. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold text-white cursor-pointer"
              >
                Hapus Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
