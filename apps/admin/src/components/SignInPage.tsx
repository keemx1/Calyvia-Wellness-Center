'use client';

import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  X,
  Sun,
  Moon,
  Loader2,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeProvider';

export const SignInPage: React.FC = () => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Sign In Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please provide both your institutional email and password.');
      return;
    }

    setIsSubmitting(true);
    const res = await login(email, password, rememberMe);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Invalid credentials or account is not authorized.');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/20 transition-colors duration-200">
      {/* Top Utility Bar */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-medium text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Calyvia HMIS • Secure Institutional Portal</span>
        </div>

        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-9 h-9 rounded-xl bg-surface hover:bg-surface-elevated border border-border text-foreground flex items-center justify-center hover:border-primary/50 transition-all duration-150 shadow-xs"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-primary" />
          )}
        </button>
      </div>

      {/* Main Authentication Container */}
      <div className="w-full max-w-md mx-auto px-4 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        {/* Brand Header */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-soft border border-primary/20 shadow-xs mb-2">
            <img
              src={theme === 'dark' ? '/brand/calyvia-emblem-dark.svg' : '/brand/calyvia-emblem-light.svg'}
              alt="Calyvia Emblem"
              width={42}
              height={42}
              className="w-10 h-10 object-contain"
            />
          </div>
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Calyvia Wellness Center
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Hospital Management Information System (HMIS / EMR)
            </p>
          </div>
        </div>

        {/* Institutional Sign In Form */}
        <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-elevated space-y-6">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Personnel Authentication</h2>
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-soft text-primary">
                <Shield className="w-3 h-3" />
                <span>Admin Provisioned</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your institutional Calyvia credentials to access assigned clinical and administrative modules.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-xs flex items-start space-x-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="e.g. username@calyviawellness.co.ke"
                  className="w-full bg-surface-subtle border border-border rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-foreground">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter clinical account password"
                  className="w-full bg-surface-subtle border border-border rounded-xl pl-9 pr-10 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Session */}
            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary/20 w-3.5 h-3.5 accent-primary"
              />
              <label htmlFor="rememberMe" className="text-xs text-muted-foreground select-none cursor-pointer">
                Maintain session on this clinical workstation
              </label>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover active:scale-[0.99] shadow-xs transition-all flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to EMR</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Security & Regulatory Compliance Footer */}
      <footer className="w-full border-t border-border/60 py-4 px-4 text-center text-[11px] text-muted-foreground space-y-1">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 text-primary">
            <Shield className="w-3.5 h-3.5" />
            <span>Authorized Healthcare Personnel Only</span>
          </span>
          <span>•</span>
          <span>Kenya Data Protection Act, 2019 (Sections 44–47)</span>
          <span>•</span>
          <span>Argon2id & AES-256-GCM Cryptographic Protection</span>
        </div>
        <p className="text-[10px] text-muted-foreground/80">
          Calyvia Wellness Center • Behind Full Gospel Church, Mugutha, Ruiru, Kiambu County
        </p>
      </footer>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-3xl max-w-md w-full p-6 shadow-elevated space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2 text-primary">
                <HelpCircle className="w-5 h-5" />
                <h3 className="font-semibold text-sm text-foreground">Password Recovery Protocol</h3>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>
                In compliance with the Kenya Data Protection Act 2019 and Calyvia institutional security policies, clinical account passwords cannot be reset via unverified public email links.
              </p>
              <div className="p-3 rounded-xl bg-surface-subtle border border-border space-y-1">
                <div className="font-semibold text-foreground">Self-Recovery Procedure:</div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li>Contact the Facility Administrator at <span className="font-mono text-primary">admin@calyviawellness.co.ke</span></li>
                  <li>Or visit the ICT & Records Department in person with your staff identification badge.</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover shadow-xs transition-all"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
