import React, { useState } from 'react';
import { X, Lock, Mail, User, Shield, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, register, loginDemo, isLoading } = useAuth();
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (mode === 'LOGIN') {
        await login(email, password);
      } else {
        await register({ email, password, firstName, workspaceName });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  const handleQuickDemo = async () => {
    setError(null);
    try {
      await loginDemo();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    }
  };

  return (
    <div
      id="auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs text-xs"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Shield className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              {mode === 'LOGIN' ? 'Log in to Statusmith' : 'Create Statusmith Account'}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-rose-700">
            {error}
          </div>
        )}

        {/* Quick Demo Button */}
        <div className="mt-4 rounded-xl bg-blue-50/70 border border-blue-200 p-3 flex items-center justify-between">
          <div>
            <span className="font-bold text-blue-900 block">Instant Demo Access</span>
            <span className="text-[11px] text-blue-700">Test with full administrative rights</span>
          </div>
          <button
            type="button"
            id="quick-demo-login-btn"
            onClick={handleQuickDemo}
            disabled={isLoading}
            className="rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white hover:bg-blue-700 transition shadow-xs"
          >
            1-Click Demo
          </button>
        </div>

        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <span className="relative bg-white px-2 text-[11px] text-slate-400 uppercase">
            or with credentials
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'REGISTER' && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">First Name</label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Workspace Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Production"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                />
              </div>
            </>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="auth-email-input"
                type="email"
                required
                placeholder="developer@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="auth-password-input"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-slate-800"
              />
            </div>
          </div>

          <button
            type="submit"
            id="auth-submit-btn"
            disabled={isLoading}
            className="w-full rounded-lg bg-slate-900 py-2.5 font-bold text-white hover:bg-slate-800 transition shadow-xs mt-2 disabled:opacity-50"
          >
            {isLoading ? 'Authenticating…' : mode === 'LOGIN' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 text-center border-t border-slate-100 pt-3 text-slate-500">
          {mode === 'LOGIN' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('REGISTER');
                }}
                className="font-bold text-blue-600 hover:underline"
              >
                Sign up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('LOGIN');
                }}
                className="font-bold text-blue-600 hover:underline"
              >
                Sign in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
