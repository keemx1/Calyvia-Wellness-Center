'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
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

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

type SiteKeyStatus = 'loading' | 'ready' | 'unavailable';

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

  // Cloudflare Turnstile state. The site key comes from the API at runtime;
  // the secret key is never sent to this browser.
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [siteKeyStatus, setSiteKeyStatus] = useState<SiteKeyStatus>('loading');
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Fetch the public site key. The secret key stays on the API.
  useEffect(() => {
    let cancelled = false;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

    fetch(`${apiUrl}/auth/turnstile/site-key`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Site key request failed (${res.status})`);
        return res.json() as Promise<{ siteKey?: string | null }>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.siteKey) {
          setSiteKey(data.siteKey);
          setSiteKeyStatus('ready');
        } else {
          setSiteKeyStatus('unavailable');
          setErrorMessage('Security verification is not configured. Please contact IT.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSiteKeyStatus('unavailable');
        setErrorMessage('Security verification is unavailable. Please contact IT.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Render the explicit Turnstile widget once the script and site key are ready.
  useEffect(() => {
    if (!siteKey || !turnstileReady || !widgetHostRef.current || !window.turnstile) return;

    const widgetId = window.turnstile.render(widgetHostRef.current, {
      sitekey: siteKey,
      theme: theme === 'dark' ? 'dark' : 'light',
      callback: (token: string) => {
        setTurnstileToken(token);
        // Clearing a refreshed challenge must not hide a login error such as
        // "Invalid email or password" shown after a failed attempt.
        setErrorMessage((current) =>
          current?.startsWith('Security verification') ? null : current,
        );
      },
      'expired-callback': () => {
        setTurnstileToken(null);
        setErrorMessage('Security verification expired. Please complete it again.');
      },
      'error-callback': () => {
        setTurnstileToken(null);
        setErrorMessage('Security verification failed. Please try again.');
      },
    });
    widgetIdRef.current = widgetId;

    return () => {
      try {
        window.turnstile?.remove(widgetId);
      } catch {
        // Ignore cleanup errors from a widget that was already removed.
      }
      if (widgetIdRef.current === widgetId) widgetIdRef.current = null;
      setTurnstileToken(null);
    };
  }, [siteKey, turnstileReady, theme]);

  const resetTurnstile = () => {
    setTurnstileToken(null);
    const widgetId = widgetIdRef.current;
    if (widgetId && window.turnstile) {
      try {
        window.turnstile.reset(widgetId);
      } catch {
        // The widget may already have expired; the render callback will restore it.
      }
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please provide both your institutional email and password.');
      return;
    }
    if (siteKeyStatus !== 'ready' || !siteKey) {
      setErrorMessage('Security verification is unavailable. Please contact IT.');
      return;
    }
    if (!turnstileToken) {
      setErrorMessage('Please complete the security verification checkbox.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(email, password, turnstileToken, rememberMe);
      if (!res.success) {
        setErrorMessage(res.error || 'Invalid credentials or account is not authorized.');
        // Failed attempts burn the token; force a fresh challenge before retrying.
        resetTurnstile();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/20 transition-colors duration-200">
      {siteKeyStatus === 'ready' && siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          onLoad={() => setTurnstileReady(true)}
          onError={() => {
            setSiteKeyStatus('unavailable');
            setErrorMessage('Security verification could not be loaded. Please contact IT.');
          }}
        />
      )}

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
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Calyvia Wellness Center
          </h1>
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

            {/* Cloudflare Turnstile */}
            <div className="space-y-1.5 pt-1 text-center">
              <label className="block text-xs font-semibold text-foreground">
                Security Verification
              </label>
              <div ref={widgetHostRef} className="flex min-h-[65px] justify-center" />
              {siteKeyStatus === 'loading' && (
                <p className="text-[11px] text-muted-foreground">Loading security verification…</p>
              )}
              {siteKeyStatus === 'unavailable' && (
                <p className="text-[11px] text-danger">
                  Security verification is unavailable. Please contact IT.
                </p>
              )}
              {siteKeyStatus === 'ready' && !turnstileToken && (
                <p className="text-[11px] text-muted-foreground">
                  Please complete the verification checkbox above.
                </p>
              )}
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting || siteKeyStatus !== 'ready' || !turnstileToken}
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
