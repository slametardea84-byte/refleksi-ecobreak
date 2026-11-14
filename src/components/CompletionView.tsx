import React, { useState } from 'react';
import { CheckCircle2, FileText, Home, Printer, X } from 'lucide-react';
import ecosystemBg from '../assets/images/ecosystem_thankyou_bg_1794620525636.jpg';
import { REFLECTION_PARTS, type OptionKey } from '../data/questions';
import type { SubmissionRecord } from '../types';

interface CompletionViewProps {
  submission: SubmissionRecord;
  onReturnHome: () => void;
}

export const CompletionView: React.FC<CompletionViewProps> = ({
  submission,
  onReturnHome,
}) => {
  const [imgError, setImgError] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center overflow-x-hidden bg-emerald-950 text-white">
      {/* Lush Ecosystem & Nature Background */}
      {!imgError && (
        <img
          src={ecosystemBg}
          alt="Ekosistem alam yang indah dihuni beragam hewan dan tumbuhan"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="fixed inset-0 w-full h-full object-cover object-center"
        />
      )}

      {/* Measured Contrast Scrim */}
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-gradient-to-b from-emerald-950/65 via-slate-950/55 to-emerald-950/85"
      />

      {/* Centered Thank-You Message Card */}
      <main className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-8 py-12">
        <div className="bg-slate-950/65 backdrop-blur-md border border-white/20 rounded-3xl p-7 sm:p-12 text-center shadow-2xl space-y-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-300/30 text-emerald-200 mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-4">
            <h1 className="font-display-serif text-2xl sm:text-4xl font-semibold tracking-tight text-white leading-snug text-balance">
              Terima kasih telah mengikuti kegiatan kokurikuler Minggu ini
            </h1>
            <p className="text-base sm:text-xl text-emerald-100 leading-relaxed max-w-2xl mx-auto text-balance">
              Mulai dari langkah kecil, kita wujudkan lingkungan yang lebih bersih, aman, nyaman, dan kreatif.
            </p>
          </div>

          {/* Unboxed Student Submission Receipt */}
          <div className="pt-4 border-t border-white/15 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:text-sm text-emerald-100/90">
            <span className="font-semibold text-white">{submission.nama}</span>
            <span aria-hidden="true">·</span>
            <span>Kelas {submission.kelas}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">Absen {submission.absen}</span>
            <span aria-hidden="true">·</span>
            <span>{submission.email}</span>
            <span aria-hidden="true">·</span>
            <span>Refleksi Tersimpan</span>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Lihat Ringkasan Jawaban</span>
            </button>
            <button
              type="button"
              onClick={onReturnHome}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Kembali ke Halaman Awal</span>
            </button>
          </div>
        </div>
      </main>

      {/* Summary Drawer / Modal */}
      {showSummary && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ringkasan Jawaban Refleksi"
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Ringkasan Jawaban Refleksi
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {submission.nama} · Kelas {submission.kelas} · Absen {submission.absen} · {submission.email}
                </p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSummary(false)}
                  aria-label="Tutup ringkasan"
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {REFLECTION_PARTS.map((part) => (
                <div key={part.id} className="space-y-4">
                  <h3 className="text-sm font-bold text-emerald-800 border-b border-slate-200 pb-1.5">
                    {part.title}
                  </h3>
                  {part.subSections.map((sub) => (
                    <div key={sub.id} className="space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500">
                        {sub.title}
                      </h4>
                      <div className="space-y-2.5">
                        {sub.questions.map((q) => {
                          const ans = submission.answers[q.id] || '-';
                          const displayAnswer =
                            q.type === 'mcq' && ans in q.options
                              ? `${ans}. ${q.options[ans as OptionKey]}`
                              : ans;
                          return (
                            <div
                              key={q.id}
                              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                            >
                              <p className="font-medium text-slate-800">
                                {q.number}. {q.prompt}
                              </p>
                              <p className="text-slate-700 mt-1.5">
                                <span className="font-semibold text-emerald-700">Jawaban: </span>
                                {displayAnswer}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
