import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  ALL_MCQ_QUESTIONS,
  ALL_QUESTIONS,
  STUDENT_PASSWORD,
} from '../data/questions';
import type { DriveSyncSettings, StudentIdentity, SubmissionRecord } from '../types';

export const TEACHER_EMAIL = 'slametardea84@guru.smp.belajar.id';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Standard Google Auth provider for students
const studentProvider = new GoogleAuthProvider();
studentProvider.setCustomParameters({ prompt: 'select_account' });

// Workspace Google Auth provider for teacher Drive & Sheets sync
const workspaceProvider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  workspaceProvider.addScope(scope);
}
workspaceProvider.setCustomParameters({ prompt: 'select_account' });

// In-memory access token cache (never persisted in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export const initAuth = (
  onAuthChange: (user: User | null, hasWorkspaceToken: boolean) => void
) => {
  return onAuthStateChanged(auth, (user) => {
    if (!user && !isSigningIn) {
      cachedAccessToken = null;
    }
    onAuthChange(user, Boolean(cachedAccessToken));
  });
};

export const studentGoogleSignIn = async (): Promise<User> => {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, studentProvider);
    return result.user;
  } finally {
    isSigningIn = false;
  }
};

export const teacherGoogleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, workspaceProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan izin akses Google Drive & Sheets.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getWorkspaceAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const clearWorkspaceAccessToken = (): void => {
  cachedAccessToken = null;
};

export const logoutGoogle = async (): Promise<void> => {
  cachedAccessToken = null;
  await signOut(auth);
};

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function mapSubmissionDoc(id: string, data: Record<string, unknown>): SubmissionRecord {
  return {
    id,
    uid: String(data.uid || id),
    email: String(data.email || ''),
    nama: String(data.nama || ''),
    kelas: String(data.kelas || ''),
    absen: Number(data.absen || 0),
    answers: (data.answers as Record<string, string>) || {},
    skorPg: Number(data.skorPg || 0),
    totalPg: Number(data.totalPg || ALL_MCQ_QUESTIONS.length),
    persentasePg: Number(data.persentasePg || 0),
    submittedAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

export async function getStudentSubmission(
  uid: string
): Promise<SubmissionRecord | null> {
  const path = `submissions/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'submissions', uid));
    if (!snap.exists()) return null;
    return mapSubmissionDoc(snap.id, snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveStudentSubmission(
  user: User,
  identity: StudentIdentity,
  rawAnswers: Record<string, string>
): Promise<SubmissionRecord> {
  const sanitizedAnswers: Record<string, string> = {};
  for (const q of ALL_QUESTIONS) {
    const val = (rawAnswers[q.id] || '').trim();
    sanitizedAnswers[q.id] = q.type === 'mcq' ? val : val.slice(0, 2000);
  }

  let correct = 0;
  for (const q of ALL_MCQ_QUESTIONS) {
    if (sanitizedAnswers[q.id] === q.correctOption) {
      correct += 1;
    }
  }
  const totalPg = ALL_MCQ_QUESTIONS.length;
  const persentasePg = totalPg > 0 ? Math.round((correct / totalPg) * 100) : 0;

  const docRef = doc(db, 'submissions', user.uid);
  const path = `submissions/${user.uid}`;

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const sanitizedName = identity.nama.trim().slice(0, 100);

  if (existingSnap && existingSnap.exists()) {
    try {
      await updateDoc(docRef, {
        nama: sanitizedName,
        kelas: identity.kelas,
        absen: Number(identity.absen),
        answers: sanitizedAnswers,
        skorPg: correct,
        persentasePg,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    try {
      await setDoc(docRef, {
        uid: user.uid,
        email: user.email || identity.email,
        nama: sanitizedName,
        kelas: identity.kelas,
        absen: Number(identity.absen),
        accessCode: STUDENT_PASSWORD,
        answers: sanitizedAnswers,
        skorPg: correct,
        totalPg,
        persentasePg,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  const updated = await getStudentSubmission(user.uid);
  if (!updated) {
    throw new Error('Gagal membaca ulang data setelah penyimpanan.');
  }

  // Best-effort mirror to local server & optional teacher Apps Script webhook
  fetch('/api/mirror-submission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  }).catch(() => {
    // Non-blocking mirror
  });

  return updated;
}

export function subscribeAllSubmissions(
  onData: (submissions: SubmissionRecord[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'submissions';
  const q = query(collection(db, path), orderBy('kelas'), orderBy('absen'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) =>
        mapSubmissionDoc(d.id, d.data() as Record<string, unknown>)
      );
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function deleteSubmissionById(id: string): Promise<void> {
  const path = `submissions/${id}`;
  try {
    await deleteDoc(doc(db, 'submissions', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getDriveSyncSettings(): Promise<DriveSyncSettings | null> {
  const path = 'settings/driveSync';
  try {
    const snap = await getDoc(doc(db, 'settings', 'driveSync'));
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    return {
      folderId: String(d.folderId || ''),
      folderName: String(d.folderName || ''),
      spreadsheetId: String(d.spreadsheetId || ''),
      spreadsheetUrl: String(d.spreadsheetUrl || ''),
      lastSyncedCount: Number(d.lastSyncedCount || 0),
      updatedBy: String(d.updatedBy || ''),
      updatedAt: toIsoString(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveDriveSyncSettings(
  uid: string,
  settings: Omit<DriveSyncSettings, 'updatedBy' | 'updatedAt'>
): Promise<void> {
  const path = 'settings/driveSync';
  try {
    await setDoc(doc(db, 'settings', 'driveSync'), {
      folderId: settings.folderId.slice(0, 200),
      folderName: settings.folderName.slice(0, 200),
      spreadsheetId: settings.spreadsheetId.slice(0, 200),
      spreadsheetUrl: settings.spreadsheetUrl.slice(0, 500),
      lastSyncedCount: Math.max(0, Math.min(5000, Math.round(settings.lastSyncedCount))),
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
