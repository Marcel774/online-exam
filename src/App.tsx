import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';

import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

import { DashboardPage } from './pages/dashboard/DashboardPage';
import { ExamsListPage } from './pages/exams/ExamsListPage';
import { ExamFormPage } from './pages/exams/ExamFormPage';
import { QuestionBankPage } from './pages/questions/QuestionBankPage';
import { ClassesPage } from './pages/admin/ClassesPage';
import { SubjectsPage } from './pages/admin/SubjectsPage';
import { StudentsPage } from './pages/admin/StudentsPage';
import { TeachersPage } from './pages/admin/TeachersPage';
import { ResultsListPage } from './pages/results/ResultsListPage';
import { ResultDetailGradePage } from './pages/results/ResultDetailGradePage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { ProfilePage } from './pages/profile/ProfilePage';

import { StudentExamsPage } from './pages/student/StudentExamsPage';
import { ExamInstructionsPage } from './pages/student/ExamInstructionsPage';
import { TakeExamPage } from './pages/student/TakeExamPage';
import { ExamHistoryPage } from './pages/student/ExamHistoryPage';

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Distraction-free Online Examination Interface */}
      <Route
        path="/student/attempt/:attemptId"
        element={
          <ProtectedRoute roles={['student']}>
            <TakeExamPage />
          </ProtectedRoute>
        }
      />

      {/* Authenticated Dashboard Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/exams"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <DashboardLayout>
              <ExamsListPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/exams/create"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <DashboardLayout>
              <ExamFormPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/exams/:id/edit"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <DashboardLayout>
              <ExamFormPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/questions"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <DashboardLayout>
              <QuestionBankPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/classes"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <DashboardLayout>
              <ClassesPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/subjects"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <DashboardLayout>
              <SubjectsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/students"
        element={
          <ProtectedRoute roles={['admin']}>
            <DashboardLayout>
              <StudentsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/teachers"
        element={
          <ProtectedRoute roles={['admin']}>
            <DashboardLayout>
              <TeachersPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute roles={['admin']}>
            <DashboardLayout>
              <StudentsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/results"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ResultsListPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/results/:id"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ResultDetailGradePage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/results/:id/grade"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <DashboardLayout>
              <ResultDetailGradePage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <DashboardLayout>
              <ReportsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute roles={['admin']}>
            <DashboardLayout>
              <SettingsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ProfilePage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Student Portal Routes */}
      <Route
        path="/student/exams/available"
        element={
          <ProtectedRoute roles={['student']}>
            <DashboardLayout>
              <StudentExamsPage mode="available" />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/exams/upcoming"
        element={
          <ProtectedRoute roles={['student']}>
            <DashboardLayout>
              <StudentExamsPage mode="upcoming" />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/exams/:id/instructions"
        element={
          <ProtectedRoute roles={['student']}>
            <DashboardLayout>
              <ExamInstructionsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/history"
        element={
          <ProtectedRoute roles={['student']}>
            <DashboardLayout>
              <ExamHistoryPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
