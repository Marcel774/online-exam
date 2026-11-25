import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [issuedToken, setIssuedToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post<{ message: string; resetToken?: string }>(
        '/auth/forgot-password',
        { email: email.trim() }
      );
      showToast(data.message, 'info');
      if (data.resetToken) {
        setIssuedToken(data.resetToken);
      } else {
        navigate('/reset-password');
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to initiate password reset.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-7 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-lg text-slate-900">EXAMPRO</span>
        </div>

        <h1 className="font-display text-2xl font-bold text-slate-900">Forgot Password</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Enter your email address to receive a time-limited password reset token.
        </p>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {issuedToken ? (
          <div className="mt-5 p-4 rounded-lg bg-indigo-50 border border-indigo-200 space-y-3">
            <p className="text-sm text-indigo-900 font-medium">
              Development Reset Token Generated:
            </p>
            <p className="font-mono text-xs bg-white px-3 py-2 rounded border border-indigo-200 break-all text-slate-800">
              {issuedToken}
            </p>
            <button
              type="button"
              onClick={() => navigate(`/reset-password?token=${encodeURIComponent(issuedToken)}`)}
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Continue to Reset Password
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@exampro.edu"
                required
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {submitting ? 'Generating Token...' : 'Request Reset Token'}
            </button>
          </form>
        )}

        <div className="mt-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
