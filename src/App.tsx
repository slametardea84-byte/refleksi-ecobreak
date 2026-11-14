/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { LoginView } from './components/LoginView';
import { ReflectionFormView } from './components/ReflectionFormView';
import { CompletionView } from './components/CompletionView';
import { TeacherDashboardModal } from './components/TeacherDashboardModal';
import { initAuth } from './lib/firebase';
import type { AppView, StudentIdentity, SubmissionRecord } from './types';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [student, setStudent] = useState<StudentIdentity | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<SubmissionRecord | null>(null);
  const [completedSubmission, setCompletedSubmission] = useState<SubmissionRecord | null>(null);
  const [showTeacherModal, setShowTeacherModal] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth((user) => {
      setGoogleUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (
    identity: StudentIdentity,
    existing: SubmissionRecord | null
  ) => {
    setStudent(identity);
    setExistingSubmission(existing);
    setView('reflection');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitted = (submission: SubmissionRecord) => {
    setCompletedSubmission(submission);
    setView('completed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetToLogin = () => {
    setStudent(null);
    setExistingSubmission(null);
    setCompletedSubmission(null);
    setView('login');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
        Menyiapkan portal refleksi...
      </div>
    );
  }

  return (
    <>
      {view === 'login' && (
        <LoginView
          googleUser={googleUser}
          onLoginSuccess={handleLoginSuccess}
          onOpenTeacherPortal={() => setShowTeacherModal(true)}
        />
      )}

      {view === 'reflection' && googleUser && student && (
        <ReflectionFormView
          googleUser={googleUser}
          student={student}
          existingSubmission={existingSubmission}
          onSubmitted={handleSubmitted}
          onLogout={handleResetToLogin}
        />
      )}

      {view === 'completed' && completedSubmission && (
        <CompletionView
          submission={completedSubmission}
          onReturnHome={handleResetToLogin}
        />
      )}

      {showTeacherModal && (
        <TeacherDashboardModal
          googleUser={googleUser}
          onClose={() => setShowTeacherModal(false)}
        />
      )}
    </>
  );
}
