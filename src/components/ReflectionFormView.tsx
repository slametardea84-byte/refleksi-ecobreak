import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react';
import {
  ALL_QUESTIONS,
  INSTRUCTIONS,
  REFLECTION_PARTS,
  type OptionKey,
} from '../data/questions';
import {
  saveReflectionPart,
  submitFullReflection,
} from '../lib/studentApi';
import type { StudentIdentity, SubmissionRecord } from '../types';

interface ReflectionFormViewProps {
  student: StudentIdentity;
  existingSubmission: SubmissionRecord | null;
  onSubmitted: (submission: SubmissionRecord) => void;
  onLogout: () => void;
}

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

export const ReflectionFormView: React.FC<ReflectionFormViewProps> = ({
  student,
  existingSubmission,
  onSubmitted,
  onLogout,
}) => {
  const draftKey = `refleksi_draft_${student.kelas}_${student.absen}`;

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    if (existingSubmission?.answers) {
      return { ...existingSubmission.answers };
    }
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return {};
  });

  const [savedParts, setSavedParts] = useState<string[]>(
    () => existingSubmission?.completedParts || []
  );
  const [activePartIndex, setActivePartIndex] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [partSavedBanner, setPartSavedBanner] = useState('');
  const [highlightedMissingId, setHighlightedMissingId] = useState<string | null>(null);
  const [isSavingPart, setIsSavingPart] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(answers));
    } catch {
      // ignore storage quota errors
    }
  }, [answers, draftKey]);

  const totalCount = ALL_QUESTIONS.length;

  const answeredCount = useMemo(() => {
    return ALL_QUESTIONS.filter((q) => (answers[q.id] || '').trim().length > 0).length;
  }, [answers]);

  const partCompletion = useMemo(() => {
    return REFLECTION_PARTS.map((part) => {
      const qs = part.subSections.flatMap((s) => s.questions);
      const done = qs.filter((q) => (answers[q.id] || '').trim().length > 0).length;
      return { done, total: qs.length };
    });
  }, [answers]);

  const currentPart = REFLECTION_PARTS[activePartIndex];
  const progressPercent = Math.round((answeredCount / totalCount) * 100);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (highlightedMissingId === questionId && value.trim().length > 0) {
      setHighlightedMissingId(null);
      setSubmitError('');
    }
  };

  const jumpToPart = (index: number) => {
    setSubmitError('');
    setActivePartIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const findFirstMissingInPart = (partIndex: number): string | null => {
    const part = REFLECTION_PARTS[partIndex];
    for (const sub of part.subSections) {
      for (const q of sub.questions) {
        if (!(answers[q.id] || '').trim()) {
          return q.id;
        }
      }
    }
    return null;
  };

  const findFirstMissingGlobal = (): { partIndex: number; questionId: string } | null => {
    for (let pIdx = 0; pIdx < REFLECTION_PARTS.length; pIdx++) {
      const qId = findFirstMissingInPart(pIdx);
      if (qId) return { partIndex: pIdx, questionId: qId };
    }
    return null;
  };

  const saveCurrentPartAndAdvance = async () => {
    setSubmitError('');
    setPartSavedBanner('');

    const missingInCurrent = findFirstMissingInPart(activePartIndex);
    if (missingInCurrent) {
      setSubmitError(
        `Lengkapi seluruh pertanyaan pada ${currentPart.shortTitle} sebelum menyimpan dan melanjutkan.`
      );
      setHighlightedMissingId(missingInCurrent);
      const el = document.getElementById(`question-${missingInCurrent}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSavingPart(true);
    try {
      const result = await saveReflectionPart(student, currentPart.id, answers);
      if (!result.ok || !result.submission) {
        setSubmitError(result.error || 'Gagal menyimpan bagian ini.');
        return;
      }

      setSavedParts(result.submission.completedParts || []);
      setPartSavedBanner(
        `${currentPart.shortTitle} berhasil disimpan dan dikirim ke data guru.`
      );
      const nextIdx = activePartIndex + 1;
      setActivePartIndex(nextIdx);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSubmitError(
        'Koneksi terputus saat menyimpan bagian ini. Draft jawaban tetap aman di perangkat.'
      );
    } finally {
      setIsSavingPart(false);
    }
  };

  const handleFinalSubmit = async () => {
    setSubmitError('');
    setPartSavedBanner('');

    const missing = findFirstMissingGlobal();
    if (missing) {
      const remainingCount = totalCount - answeredCount;
      setSubmitError(
        `Masih ada ${remainingCount} pertanyaan yang belum dijawab. Kamu diarahkan ke pertanyaan yang belum diisi.`
      );
      setActivePartIndex(missing.partIndex);
      setHighlightedMissingId(missing.questionId);
      setTimeout(() => {
        const el = document.getElementById(`question-${missing.questionId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }

    setIsSavingPart(true);
    try {
      const result = await submitFullReflection(student, answers);
      if (!result.ok || !result.submission) {
        setSubmitError(result.error || 'Gagal mengirim refleksi akhir.');
        return;
      }
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      onSubmitted(result.submission);
    } catch {
      setSubmitError(
        'Koneksi terputus saat mengirim jawaban. Draft jawaban tetap aman, silakan coba klik Kirim lagi.'
      );
    } finally {
      setIsSavingPart(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar — 3 Zones */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 truncate max-w-[180px] sm:max-w-none">
            SMP Kemala Bhayangkari 7 Porong
          </span>

          <nav
            aria-label="Tahap refleksi"
            className="hidden md:flex items-center gap-5 text-sm font-medium"
          >
            {REFLECTION_PARTS.map((part, idx) => {
              const isActive = idx === activePartIndex;
              const isSaved = savedParts.includes(part.id);
              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => jumpToPart(idx)}
                  className={`py-1 inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-emerald-700 font-semibold border-b-2 border-emerald-700'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>{part.shortTitle}</span>
                  {isSaved && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </div>
        {/* Thin Progress Line */}
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6">
        {/* Student Identity & Progress Strip (Unboxed Metadata) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500">
              <span className="font-semibold text-slate-900">{student.nama}</span>
              <span aria-hidden="true">·</span>
              <span>Kelas {student.kelas}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">Absen {student.absen}</span>
            </div>
            {existingSubmission && (
              <p className="text-xs text-emerald-700">
                Progres sebelumnya ditemukan ({savedParts.length}/4 bagian tersimpan). Kamu dapat melanjutkan atau memperbarui jawabanmu.
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-600 shrink-0">
            <span className="font-mono-tabular">
              <strong className="text-slate-900">{answeredCount}</strong> / {totalCount} terjawab ({progressPercent}%)
            </span>
            <button
              type="button"
              onClick={() => setShowInstructions((prev) => !prev)}
              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium cursor-pointer whitespace-nowrap"
            >
              <span>Petunjuk</span>
              {showInstructions ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Petunjuk Pengerjaan */}
        {showInstructions && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Petunjuk Pengerjaan
            </h2>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-slate-600">
              {INSTRUCTIONS.map((inst, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono-tabular text-xs font-semibold text-emerald-700 pt-0.5">
                    0{i + 1}.
                  </span>
                  <span>{inst}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Part Switcher Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-200/70 rounded-xl">
          {REFLECTION_PARTS.map((part, idx) => {
            const isActive = idx === activePartIndex;
            const stats = partCompletion[idx];
            const isSaved = savedParts.includes(part.id);
            const isComplete = stats.done === stats.total;
            return (
              <button
                key={part.id}
                type="button"
                onClick={() => jumpToPart(idx)}
                className={`px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-semibold truncate inline-flex items-center gap-1">
                    {isSaved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    <span>{part.shortTitle}</span>
                  </span>
                  <span
                    className={`font-mono-tabular text-xs shrink-0 ${
                      isComplete ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {stats.done}/{stats.total}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {partSavedBanner && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{partSavedBanner}</span>
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900"
          >
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Active Part Heading */}
        <section className="space-y-8">
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {currentPart.title}
            </h1>
            {currentPart.description && (
              <p className="text-sm sm:text-base text-slate-600">
                {currentPart.description}
              </p>
            )}
          </div>

          {/* SubSections */}
          {currentPart.subSections.map((sub) => (
            <div key={sub.id} className="space-y-5">
              <div className="pb-2 border-b border-slate-200">
                <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                  {sub.title}
                </h2>
              </div>

              <div className="space-y-5">
                {sub.questions.map((question) => {
                  const value = answers[question.id] || '';
                  const isMissingHighlighted = highlightedMissingId === question.id;

                  return (
                    <div
                      key={question.id}
                      id={`question-${question.id}`}
                      className={`bg-white border rounded-2xl p-5 sm:p-6 transition-colors ${
                        isMissingHighlighted
                          ? 'border-amber-500 ring-2 ring-amber-500/20'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-start gap-3">
                          <span className="font-mono-tabular text-sm font-semibold text-emerald-700 pt-0.5 shrink-0">
                            {question.number}.
                          </span>
                          <p className="text-sm sm:text-base font-medium text-slate-900 leading-relaxed">
                            {question.prompt}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap shrink-0 pt-1">
                          {question.type === 'mcq' ? 'Pilihan Ganda' : 'Esai Singkat'}
                        </span>
                      </div>

                      {question.type === 'mcq' ? (
                        <div className="grid grid-cols-1 gap-2.5 pl-0 sm:pl-6">
                          {OPTION_KEYS.map((optKey) => {
                            const isSelected = value === optKey;
                            return (
                              <button
                                key={optKey}
                                type="button"
                                onClick={() => handleAnswerChange(question.id, optKey)}
                                aria-pressed={isSelected}
                                className={`w-full min-h-[44px] text-left px-4 py-3 rounded-xl border text-sm flex items-start gap-3 transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-50 border-emerald-600 text-slate-900'
                                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100/80 hover:border-slate-300'
                                }`}
                              >
                                <span
                                  className={`w-6 h-6 rounded-md font-mono-tabular text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5 ${
                                    isSelected
                                      ? 'bg-emerald-700 text-white'
                                      : 'bg-white border border-slate-300 text-slate-600'
                                  }`}
                                >
                                  {isSelected ? <Check className="w-3.5 h-3.5" /> : optKey}
                                </span>
                                <span className="leading-relaxed flex-1">
                                  <span className="font-semibold mr-1.5">{optKey}.</span>
                                  {question.options[optKey]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="pl-0 sm:pl-6 space-y-2">
                          <textarea
                            rows={3}
                            value={value}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            placeholder={question.placeholder || 'Tuliskan jawabanmu di sini...'}
                            maxLength={2000}
                            className="w-full px-4 py-3 text-sm text-slate-900 bg-slate-50/60 border border-slate-300 rounded-xl placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors resize-y"
                          />
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>
                              {value.trim().length > 0 ? 'Jawaban tercatat' : 'Wajib diisi'}
                            </span>
                            <span className="font-mono-tabular">{value.length}/2000</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Bottom Navigation Bar */}
        <div className="pt-6 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => jumpToPart(Math.max(0, activePartIndex - 1))}
            disabled={activePartIndex === 0 || isSavingPart}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Bagian Sebelumnya</span>
          </button>

          {activePartIndex < REFLECTION_PARTS.length - 1 ? (
            <button
              type="button"
              onClick={saveCurrentPartAndAdvance}
              disabled={isSavingPart}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>
                {isSavingPart
                  ? 'Menyimpan Bagian...'
                  : `Simpan & Lanjut ke ${REFLECTION_PARTS[activePartIndex + 1].shortTitle}`}
              </span>
              {!isSavingPart && <ArrowRight className="w-4 h-4" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isSavingPart}
              className="min-h-[48px] px-7 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSavingPart ? 'Mengirim Jawaban...' : 'Kirim Jawaban Refleksi'}</span>
            </button>
          )}
        </div>
      </main>
    </div>
  );
};
