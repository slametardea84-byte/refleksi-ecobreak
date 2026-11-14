import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  ABSEN_NUMBERS,
  CLASS_GROUPS,
  INSTRUCTIONS,
  STUDENT_PASSWORD,
} from '../data/questions';
import {
  getStudentSubmission,
  logoutGoogle,
  studentGoogleSignIn,
} from '../lib/firebase';
import type { StudentIdentity, SubmissionRecord } from '../types';
import heroSchoolImg from '../assets/images/hero_school_ecobrick_1794620524862.jpg';

interface LoginViewProps {
  googleUser: User | null;
  onLoginSuccess: (identity: StudentIdentity, existing: SubmissionRecord | null) => void;
  onOpenTeacherPortal: () => void;
}

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

export const LoginView: React.FC<LoginViewProps> = ({
  googleUser,
  onLoginSuccess,
  onOpenTeacherPortal,
}) => {
  const [nama, setNama] = useState(googleUser?.displayName || '');
  const [kelas, setKelas] = useState('');
  const [absen, setAbsen] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (googleUser?.displayName && !nama) {
      setNama(googleUser.displayName);
    }
  }, [googleUser, nama]);

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoggingInGoogle(true);
    try {
      const signedInUser = await studentGoogleSignIn();
      if (signedInUser.displayName) {
        setNama((prev) => prev || signedInUser.displayName || '');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setError('Gagal masuk dengan akun Google. Pastikan pop-up browser diizinkan lalu coba lagi.');
      }
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const handleSwitchAccount = async () => {
    setError('');
    await logoutGoogle();
    setNama('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!googleUser) {
      setError('Silakan login menggunakan akun Google kamu terlebih dahulu.');
      return;
    }
    if (nama.trim().length < 2) {
      setError('Mohon masukkan nama lengkap kamu dengan benar.');
      return;
    }
    if (!kelas) {
      setError('Mohon pilih kelas kamu (71–95).');
      return;
    }
    if (!absen) {
      setError('Mohon pilih nomor absen kamu (1–30).');
      return;
    }
    if (password.trim() !== STUDENT_PASSWORD) {
      setError('Password salah. Gunakan password kegiatan yang diberikan guru.');
      return;
    }

    setIsSubmitting(true);
    try {
      const existing = await getStudentSubmission(googleUser.uid);
      onLoginSuccess(
        {
          uid: googleUser.uid,
          email: googleUser.email || '',
          nama: nama.trim(),
          kelas,
          absen: Number(absen),
          password: password.trim(),
        },
        existing
      );
    } catch {
      setError('Gagal memuat data siswa dari database. Periksa koneksi internetmu dan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Navigation Bar — 3 Zones */}
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            SMP Kemala Bhayangkari 7 Porong
          </span>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#petunjuk" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Petunjuk
            </a>
            <a href="#materi" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Materi Mingguan
            </a>
            <a href="#masuk-siswa" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Masuk Siswa
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onOpenTeacherPortal}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Mode Guru
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left Column: Hero, Visual, & Petunjuk */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-emerald-700">
                <span>Refleksi Kokurikuler Mingguan</span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span className="text-slate-500">13 Kelas (71–95)</span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span className="text-slate-500">Login Akun Google Siswa</span>
              </div>

              <h1 className="font-display-serif text-3xl sm:text-4xl lg:text-[2.65rem] font-semibold tracking-tight text-slate-900 leading-[1.15] text-balance">
                Refleksi Kegiatan Kokurikuler Lingkungan &amp; Karakter
              </h1>

              <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                Portal refleksi individu untuk mengevaluasi pemahaman, pengalaman berkarya ecobrick, budaya sekolah aman dan nyaman (BSAN), serta keteladanan Hari Pahlawan selama satu minggu kegiatan.
              </p>
            </div>

            {/* Hero Illustration */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-emerald-950/5">
              {!imgError ? (
                <img
                  src={heroSchoolImg}
                  alt="Suasana halaman sekolah hijau SMP Kemala Bhayangkari 7 Porong dengan tanaman dan karya ecobrick"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 p-6 text-center">
                  <BookOpen className="w-10 h-10 text-emerald-700 mb-2" />
                  <p className="text-sm font-semibold text-emerald-900">
                    Kegiatan Kokurikuler SMP Kemala Bhayangkari 7 Porong
                  </p>
                </div>
              )}
            </div>

            {/* Petunjuk Pengerjaan & Materi */}
            <div id="petunjuk" className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Petunjuk Pengerjaan
                </h2>
                <ol className="space-y-2 text-sm text-slate-600">
                  {INSTRUCTIONS.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="font-mono-tabular text-xs font-semibold text-emerald-700 pt-0.5 shrink-0">
                        0{idx + 1}.
                      </span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div id="materi" className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Cakupan Refleksi (3 Bagian + Refleksi Diri)
                </h2>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Bagian 1: Sampah, BSAN, &amp; Hari Pahlawan</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Bagian 2: Persiapan &amp; Tutorial Ecobrick</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Bagian 3: Sketsa Karya &amp; Penimbangan (min. 210 gr)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Refleksi Akhir Diri: 5 Pertanyaan Terbuka</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column: Student Google Sign-In & Identity Form */}
          <div id="masuk-siswa" className="lg:col-span-5 flex flex-col justify-center">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="pb-4 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900">
                  Masuk Siswa
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Masuk dengan akun Google masing-masing, lalu lengkapi identitas dan password kegiatan.
                </p>
              </div>

              {/* Step 1: Google Account Login */}
              <div className="space-y-2.5">
                <span className="block text-xs font-semibold text-slate-500">
                  Langkah 1 · Akun Google Siswa
                </span>
                {!googleUser ? (
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoggingInGoogle}
                    className="gsi-material-button"
                  >
                    <div className="gsi-material-button-content-wrapper">
                      <div className="gsi-material-button-icon">
                        <GoogleLogoSvg />
                      </div>
                      <span className="gsi-material-button-contents">
                        {isLoggingInGoogle ? 'Menghubungkan...' : 'Sign in with Google'}
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-800">
                        Akun Google Terhubung
                      </p>
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {googleUser.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSwitchAccount}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Ganti Akun</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2: Identitas & Password */}
              <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-100" noValidate>
                <span className="block text-xs font-semibold text-slate-500">
                  Langkah 2 · Identitas &amp; Password Kegiatan
                </span>

                <div>
                  <label
                    htmlFor="student-name"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Nama Lengkap
                  </label>
                  <input
                    id="student-name"
                    type="text"
                    required
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="Tuliskan nama lengkapmu"
                    autoComplete="name"
                    className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="student-class"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Kelas
                    </label>
                    <select
                      id="student-class"
                      required
                      value={kelas}
                      onChange={(e) => setKelas(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors"
                    >
                      <option value="">Pilih Kelas</option>
                      {CLASS_GROUPS.map((group) => (
                        <optgroup key={group.gradeLabel} label={group.gradeLabel}>
                          {group.classes.map((cls) => (
                            <option key={cls} value={cls}>
                              Kelas {cls}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="student-absen"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Nomor Absen
                    </label>
                    <select
                      id="student-absen"
                      required
                      value={absen}
                      onChange={(e) => setAbsen(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors"
                    >
                      <option value="">Pilih Absen</option>
                      {ABSEN_NUMBERS.map((num) => (
                        <option key={num} value={num}>
                          Absen {num}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="student-password"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Password Kegiatan
                  </label>
                  <div className="relative">
                    <input
                      id="student-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password dari guru"
                      className="w-full min-h-[44px] pl-3.5 pr-11 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !googleUser}
                  className="w-full min-h-[48px] px-6 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  <span>
                    {isSubmitting ? 'Memeriksa Data...' : 'Mulai Mengerjakan Refleksi'}
                  </span>
                  {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-5">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>SMP Kemala Bhayangkari 7 Porong · Kegiatan Kokurikuler Mingguan</span>
          <span>Kelas 7 (71–73) · Kelas 8 (81–85) · Kelas 9 (91–95)</span>
        </div>
      </footer>
    </div>
  );
};
