import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../services/api';

export function LoginPage() {
  const { login, bootstrapWorkspace, setupStatus } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // First-run initialization state
  const [initName, setInitName] = useState('Dr. Evelyn Mercer');
  const [initEmail, setInitEmail] = useState('admin@exampro.edu');
  const [initPassword, setInitPassword] = useState('');
  const [bootstrapPasscode, setBootstrapPasscode] = useState('');
  const [includeSampleData, setIncludeSampleData] = useState(true);

  const needsSetup = setupStatus && !setupStatus.initialized;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedInUser = await login(email.trim(), password);
      showToast(`Welcome back, ${loggedInUser.name}.`, 'success');
      navigate('/dashboard');
    } catch (err) {
      setError(extractErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!initName.trim() || !initEmail.trim() || initPassword.length < 6) {
      setError('Provide administrator name, email, and a password of at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const { sampleAccounts } = await bootstrapWorkspace({
        name: initName.trim(),
        email: initEmail.trim(),
        password: initPassword,
        bootstrapPasscode: bootstrapPasscode.trim() || undefined,
        includeSampleData,
      });

      if (sampleAccounts.length > 0) {
        showToast(
          `Workspace initialized! Sample Teacher (teacher@exampro.edu) and Student (student@exampro.edu) accounts share your chosen password.`,
          'success'
        );
      } else {
        showToast('Administrator workspace initialized.', 'success');
      }
      navigate('/dashboard');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to initialize workspace.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Left Architectural Visual */}
      <div className="relative hidden lg:flex flex-col justify-between bg-slate-900 text-white overflow-hidden">
        <img
          src="/src/assets/images/auth_academic_study_1795592794313.jpg"
          alt="University examination hall"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/50 to-slate-900/60" />

        <div className="relative z-10 p-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">EXAMPRO</span>
        </div>

        <div className="relative z-10 p-10 max-w-xl">
          <h1 className="font-display text-3xl font-bold leading-tight text-balance">
            Structured online examinations and academic assessment management.
          </h1>
          <p className="mt-4 text-slate-200 text-base leading-relaxed">
            Built for academic institutions, instructors, and students to author question banks,
            administer timed examinations, grade subjective work, and publish verified results.
          </p>
        </div>
      </div>

      {/* Right Authentication / Setup Panel */}
      <div className="flex items-center justify-center p-6 sm:p-10 lg:p-16 bg-slate-50">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-7 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2.5 lg:hidden mb-6">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-lg text-slate-900">EXAMPRO</span>
          </div>

          {needsSetup ? (
            <>
              <div className="flex items-center gap-2 text-indigo-700 mb-2">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-xs font-semibold tracking-wide">First-Run Setup</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Initialize Administrator Account
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Create your primary administrator credentials to unlock EXAMPRO.
              </p>

              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleBootstrap} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Administrator Name
                  </label>
                  <input
                    type="text"
                    value={initName}
                    onChange={(e) => setInitName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Administrator Email
                  </label>
                  <input
                    type="email"
                    value={initEmail}
                    onChange={(e) => setInitEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Choose Workspace Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={initPassword}
                      onChange={(e) => setInitPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                      minLength={6}
                      className="w-full px-3.5 py-2.5 pr-10 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {setupStatus?.requiresPasscode && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Server Bootstrap Passcode
                    </label>
                    <input
                      type="password"
                      value={bootstrapPasscode}
                      onChange={(e) => setBootstrapPasscode(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSampleData}
                    onChange={(e) => setIncludeSampleData(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed">
                    Populate sample classes, subjects, question bank, exams, and demo teacher/student
                    accounts (<span className="font-mono">teacher@exampro.edu</span>,{' '}
                    <span className="font-mono">student@exampro.edu</span>) using this password.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Initializing Workspace...' : 'Initialize EXAMPRO Workspace'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold text-slate-900">Sign in to EXAMPRO</h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Enter your institutional credentials to access your dashboard.
              </p>

              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@exampro.edu"
                    required
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full px-3.5 py-2.5 pr-10 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              {setupStatus?.allowSelfRegistration !== false && (
                <p className="mt-6 text-center text-sm text-slate-600">
                  New student?{' '}
                  <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">
                    Create a student account
                  </Link>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
