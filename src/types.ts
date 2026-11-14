export interface StudentIdentity {
  uid: string;
  email: string;
  nama: string;
  kelas: string;
  absen: number;
  password: string;
}

export interface SubmissionRecord {
  id: string;
  uid: string;
  email: string;
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

export interface DriveSyncSettings {
  folderId: string;
  folderName: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  lastSyncedCount: number;
  updatedBy: string;
  updatedAt: string;
}

export type AppView = 'login' | 'reflection' | 'completed';
