import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { friendlyErrorMessage, requireOnline, withRequestTimeout } from "../lib/requestSafety";
import RefAILogo from "../components/branding/RefAILogo";
/**
 * RefAI — Auth (Sign in / Create account)
 *
 * Restyled to match the landing page design system exactly:
 * Inter body / Space Grotesk display / JetBrains Mono captions,
 * ink #12131a on white, --radius / --radius-sm, --shadow-sm / --shadow-md,
 * pill .btn-primary / .btn-secondary, hairline borders (#e5e9f1 family),
 * green (#0e9368) reserved for success/status only. No brown/beige,
 * no new accent colors, no gradients beyond the ones already on the
 * landing page (radial hero wash + dot grid).
 *
 * GitHub auth removed. Google + email/password only.
 * Role (student | employee) is persisted and used to route post-auth.
 */

type Role = "student" | "employee";
type Mode = "signin" | "signup" | "forgot" | "reset";

const ROLE_KEY = "refai_role";

/** Swap this for your router's navigate() — kept framework-agnostic here. */
function redirectToDashboard(role: Role) {
  window.location.href =
    role === "student" ? "/dashboard" : "/employee/dashboard";
}

export default function AuthPage(): JSX.Element {
  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<Role>("student");

  // Sign in fields
  const siEmailRef = useRef<HTMLInputElement>(null);
  const siPasswordRef = useRef<HTMLInputElement>(null);
  const [siPwVisible, setSiPwVisible] = useState(false);
  const [siError, setSiError] = useState<string | null>(null);

  // Sign up fields
  const suNameRef = useRef<HTMLInputElement>(null);
  const suCompanyRef = useRef<HTMLInputElement>(null);
  const suEmailRef = useRef<HTMLInputElement>(null);
  const suPasswordRef = useRef<HTMLInputElement>(null);
  const suConfirmRef = useRef<HTMLInputElement>(null);
  const [suPwVisible, setSuPwVisible] = useState(false);
  const [suConfirmVisible, setSuConfirmVisible] = useState(false);
  const [suError, setSuError] = useState<string | null>(null);

  // Google OAuth
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Password recovery fields
  const recoveryEmailRef = useRef<HTMLInputElement>(null);
  const resetPasswordRef = useRef<HTMLInputElement>(null);
  const resetConfirmRef = useRef<HTMLInputElement>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modal (loading -> success)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPhase, setModalPhase] = useState<"loading" | "success">(
    "loading",
  );
  const [modalMsg, setModalMsg] = useState("Signing you in…");

  function openLoadingModal(loadingMsg: string) {
    setModalOpen(true);
    setModalPhase("loading");
    setModalMsg(loadingMsg);
  }

  function runAuthSuccess(successMsg: string, destinationRole: Role = role) {
    setModalPhase("success");
    setModalMsg(successMsg);
    localStorage.setItem(ROLE_KEY, destinationRole);
    window.setTimeout(() => {
      setModalOpen(false);
      redirectToDashboard(destinationRole);
    }, 1100);
  }

  function closeModalWithError() {
    setModalOpen(false);
  }

  function normaliseEmail(value: string) {
    return value.trim().toLowerCase();
  }

  function validatePassword(value: string): string | null {
    if (value.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(value)) return "Add at least one uppercase letter.";
    if (!/[a-z]/.test(value)) return "Add at least one lowercase letter.";
    if (!/\d/.test(value)) return "Add at least one number.";
    return null;
  }

  function authMessage(error: unknown, fallback: string) {
    return friendlyErrorMessage(error, fallback);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "1") {
      setNotice("Email confirmed. Log in to continue to your RefAI dashboard.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const isRecoveryReturn = params.get('flow') === 'recovery' || window.location.hash.includes('type=recovery');
    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user || isRecoveryReturn) return;
      const metadataRole = user.user_metadata?.role;
      redirectToDashboard(metadataRole === "employee" ? "employee" : "student");
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setMode("reset");
          setNotice("Choose a new password for your account.");
        }

        if (event === "SIGNED_OUT") setOauthLoading(false);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (formLoading) return;
    setSiError(null);
    setNotice(null);

    const email = siEmailRef.current;
    const pw = siPasswordRef.current;

    if (!email || !email.value || !email.checkValidity()) {
      email?.focus();
      setSiError("Enter a valid email address.");
      return;
    }
    if (!pw || pw.value.length < 1) {
      pw?.focus();
      setSiError("Enter your password.");
      return;
    }

    openLoadingModal("Signing you in…");
    setFormLoading(true);

    try {
      requireOnline();
      const { data, error } = await withRequestTimeout(supabase.auth.signInWithPassword({
        email: normaliseEmail(email.value),
        password: pw.value,
      }));

      if (error) {
        closeModalWithError();
        setSiError(
          authMessage(
            error,
            "Unable to sign in. Check your credentials and try again.",
          ),
        );
        return;
      }

      if (!data.user) {
        closeModalWithError();
        setSiError("Unable to sign in. Please try again.");
        return;
      }

      const accountRole = data.user.user_metadata?.role;
      const destinationRole: Role =
        accountRole === "employee" || accountRole === "student"
          ? accountRole
          : role;
      if (accountRole !== "employee" && accountRole !== "student") {
        const { error: roleError } = await withRequestTimeout(supabase.auth.updateUser({ data: { role: destinationRole } }));
        if (roleError) {
          closeModalWithError();
          setSiError(authMessage(roleError, "Your account role could not be saved. Please try again."));
          return;
        }
      }
      runAuthSuccess("Welcome back!", destinationRole);
    } catch (err) {
      console.error('[RefAI email sign-in failed]', err);
      closeModalWithError();
      setSiError(authMessage(err, "Something went wrong. Please try again."));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (formLoading) return;
    setSuError(null);
    setNotice(null);

    const name = suNameRef.current;
    const company = suCompanyRef.current;
    const email = suEmailRef.current;
    const pw = suPasswordRef.current;
    const cf = suConfirmRef.current;

    if (!name || !name.value.trim()) {
      name?.focus();
      setSuError("Enter your full name.");
      return;
    }
    if (role === "employee" && (!company || !company.value.trim())) {
      company?.focus();
      setSuError("Enter your current company.");
      return;
    }
    if (!email || !email.value || !email.checkValidity()) {
      email?.focus();
      setSuError("Enter a valid email address.");
      return;
    }
    const passwordError = validatePassword(pw?.value || "");
    if (!pw || passwordError) {
      pw?.focus();
      setSuError(passwordError || "Enter a valid password.");
      return;
    }
    if (!cf || cf.value !== pw.value) {
      cf?.focus();
      setSuError("Passwords do not match.");
      return;
    }

    openLoadingModal("Creating your account…");
    setFormLoading(true);

    try {
      requireOnline();
      const { data, error } = await withRequestTimeout(supabase.auth.signUp({
        email: normaliseEmail(email.value),
        password: pw.value,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?flow=signup`,
          data: {
            full_name: name.value.trim(),
            role: role,
            ...(role === "employee"
              ? { company_name: company?.value.trim().replace(/\s+/g, " ") }
              : {}),
          },
        },
      }));

      if (error) {
        closeModalWithError();
        setSuError(
          authMessage(error, "Unable to create account. Please try again."),
        );
        return;
      }

      if (!data.user) {
        closeModalWithError();
        setSuError("Unable to create account. Please try again.");
        return;
      }

      // With email confirmation enabled, Supabase may intentionally return
      // an obfuscated user for an existing email. An empty identities array
      // lets us avoid showing a false "account created" success message.
      if (data.user.identities && data.user.identities.length === 0) {
        closeModalWithError();
        setSuError(
          "An account with this email already exists. Log in or use Forgot password.",
        );
        return;
      }

      localStorage.setItem(ROLE_KEY, role);
      if (data.session) {
        runAuthSuccess("Account created!", role);
      } else {
        closeModalWithError();
        setNotice(
          "Account created. Check your email and confirm it before logging in.",
        );
        setMode("signin");
      }
    } catch (err) {
      console.error('[RefAI email signup failed]', err);
      closeModalWithError();
      setSuError(authMessage(err, "Something went wrong. Please try again."));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (formLoading) return;
    setRecoveryError(null);
    setNotice(null);
    const email = recoveryEmailRef.current;
    if (!email || !email.value || !email.checkValidity()) {
      email?.focus();
      setRecoveryError("Enter the email address linked to your account.");
      return;
    }

    setFormLoading(true);
    try {
      requireOnline();
      const { error } = await withRequestTimeout(supabase.auth.resetPasswordForEmail(normaliseEmail(email.value), { redirectTo: `${window.location.origin}/auth?flow=recovery` }));
      if (error) { setRecoveryError(authMessage(error, "Unable to send the reset email. Please try again.")); return; }
      setNotice("If an account exists for that email, a password-reset link has been sent.");
    } catch (error) {
      console.error('[RefAI password recovery request failed]', error);
      setRecoveryError(authMessage(error, "Unable to send the reset email. Please try again."));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (formLoading) return;
    setRecoveryError(null);
    const password = resetPasswordRef.current?.value || "";
    const confirm = resetConfirmRef.current?.value || "";
    const passwordError = validatePassword(password);
    if (passwordError) {
      resetPasswordRef.current?.focus();
      setRecoveryError(passwordError);
      return;
    }
    if (password !== confirm) {
      resetConfirmRef.current?.focus();
      setRecoveryError("Passwords do not match.");
      return;
    }

    setFormLoading(true);
    try {
      requireOnline();
      const { error } = await withRequestTimeout(supabase.auth.updateUser({ password }));
      if (error) { setRecoveryError(authMessage(error, "Unable to update your password.")); return; }
      await withRequestTimeout(supabase.auth.signOut());
      setNotice("Password updated. You can now log in with your new password.");
      setMode("signin");
    } catch (error) {
      console.error('[RefAI password update failed]', error);
      setRecoveryError(authMessage(error, "Unable to update your password."));
    } finally {
      setFormLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setSiError(null);
    setSuError(null);
    setRecoveryError(null);
    setNotice(null);
  }

  async function handleGoogleSignIn() {
    if (oauthLoading || formLoading) return;
    setOauthError(null);
    setOauthLoading(true);

    // Role must survive the full-page redirect to Google and back,
    // since component state is lost. localStorage is read after the
    // redirect completes (e.g. in your dashboard/callback route).
    localStorage.setItem(ROLE_KEY, role);

    try {
      requireOnline();
      const { error } = await withRequestTimeout(supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?flow=oauth&role=${role}`,
          scopes:
            "openid email profile https://www.googleapis.com/auth/userinfo.email",
          queryParams: { prompt: "select_account" },
        },
      }));

      if (error) {
        setOauthError(
          authMessage(error, "Unable to continue with Google. Please try again."),
        );
        setOauthLoading(false);
      }
      // On success, Supabase redirects the browser to Google immediately —
      // no further code here runs, so no need to reset oauthLoading.
    } catch (err) {
      console.error('[RefAI Google OAuth request failed]', err);
      setOauthError(
        authMessage(err, "Unable to continue with Google. Please try again."),
      );
      setOauthLoading(false);
    }
  }

  return (
    <div className="ra-shell">
      <style>{`
        .ra-shell {
          --ink: #12131a;
          --muted: #626978;
          --soft: #768196;
          --border: #e5e9f1;
          --border-soft: #edf1f6;
          --surface: #fbfcff;
          --green: #0e9368;
          --radius: 20px;
          --radius-sm: 12px;
          --shadow-sm: 0 8px 24px rgba(28, 33, 48, 0.08);
          --shadow-md: 0 24px 70px rgba(34, 40, 59, 0.12);
          min-height: 100vh;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: var(--ink);
          background:
            radial-gradient(circle at 10% 0%, rgba(36, 87, 255, 0.08), transparent 28rem),
            #ffffff;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .ra-shell *, .ra-shell *::before, .ra-shell *::after { box-sizing: border-box; }
        .ra-shell::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 0;
          background-image:
            linear-gradient(rgba(18, 19, 26, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(18, 19, 26, 0.06) 1px, transparent 1px);
          background-size: 56px 56px;
          background-position: center top;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .ra-shell * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }

        .ra-brand {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: "Space Grotesk", Inter, sans-serif;
          font-weight: 700;
          font-size: 20px;
          margin-top: 40px;
        }
        .ra-brand .dot {
          width: 10px; height: 10px; border-radius: 3px;
          background: var(--ink);
          transform: rotate(45deg);
        }

        .ra-wrap {
          position: relative;
          z-index: 1;
          width: min(400px, calc(100% - 32px));
          margin: 28px auto 60px;
        }

        .ra-card {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow-md);
          padding: 32px 30px;
        }

        .ra-head h1 {
          margin: 0 0 6px 0;
          font-family: "Space Grotesk", Inter, sans-serif;
          font-weight: 700;
          font-size: 26px;
          letter-spacing: -0.02em;
        }
        .ra-head p {
          margin: 0 0 22px 0;
          color: var(--muted);
          font-size: 13.5px;
          line-height: 1.55;
        }

        .ra-role-toggle {
          display: inline-flex;
          padding: 3px;
          gap: 2px;
          background: #f4f6fa;
          border-radius: 999px;
          margin-bottom: 22px;
        }
        .ra-role-toggle button {
          border: none;
          background: transparent;
          font-family: Inter, sans-serif;
          font-size: 12.5px;
          font-weight: 800;
          padding: 8px 18px;
          border-radius: 999px;
          cursor: pointer;
          color: var(--muted);
          transition: background 0.2s ease, color 0.2s ease;
        }
        .ra-role-toggle button.active { background: #111827; color: #fff; }

        .ra-oauth-btn {
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 44px;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: #fff;
          color: var(--ink);
          font-size: 13.5px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: var(--shadow-sm);
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }
        .ra-oauth-btn:hover { transform: translateY(-2px); border-color: #c7d1e3; }
        .ra-oauth-btn:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
        .ra-oauth-btn svg { width: 16px; height: 16px; }

        .ra-divider {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 22px 0;
        }
        .ra-divider .line { flex: 1; height: 1px; background: var(--border); }
        .ra-divider span {
          font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 10px;
          font-weight: 700;
          color: var(--soft);
          white-space: nowrap;
        }

        .ra-field { margin-bottom: 16px; }
        .ra-field label {
          display: block;
          font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 10px;
          font-weight: 700;
          color: var(--soft);
          margin-bottom: 7px;
        }
        .ra-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          background: #fff;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .ra-input-wrap:focus-within {
          border-color: #111827;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
        }
        .ra-input-wrap input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          padding: 11px 12px;
          font-size: 14px;
          font-family: Inter, sans-serif;
          color: var(--ink);
        }
        .ra-input-wrap input::placeholder { color: #a3abba; }
        .ra-icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          color: var(--soft);
          flex-shrink: 0;
          border-radius: 8px;
        }
        .ra-icon-btn:hover { color: var(--ink); }
        .ra-icon-btn:focus-visible { outline: 2px solid #111827; outline-offset: -2px; }

        .ra-row-between {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          margin: -6px 0 16px 0;
        }
        .ra-forgot {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          padding: 0;
          font-family: Inter, sans-serif;
        }
        .ra-forgot:hover { color: var(--ink); }

        .ra-error {
          font-size: 12px;
          font-weight: 700;
          color: #b3452c;
          margin: -6px 0 16px 2px;
        }
        .ra-notice {
          font-size: 12.5px;
          font-weight: 700;
          line-height: 1.5;
          color: #087653;
          background: #ecf9f4;
          border: 1px solid #bde8d8;
          border-radius: 10px;
          padding: 10px 12px;
          margin: 0 0 16px;
        }
        .ra-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 0;
          background: transparent;
          color: var(--muted);
          font: 700 12px Inter, sans-serif;
          cursor: pointer;
          padding: 0;
          margin-bottom: 18px;
        }
        .ra-back:hover { color: var(--ink); }

        .ra-submit {
          width: 100%;
          min-height: 46px;
          border: none;
          border-radius: 999px;
          background: #111827;
          color: #fff;
          font-size: 14px;
          font-weight: 800;
          font-family: Inter, sans-serif;
          cursor: pointer;
          box-shadow: 0 18px 38px rgba(15, 23, 42, 0.18);
          transition: transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
        }
        .ra-submit:hover { transform: translateY(-2px); background: #000; }
        .ra-submit:focus-visible { outline: 2px solid #111827; outline-offset: 3px; }
        .ra-submit:disabled, .ra-oauth-btn:disabled {
          opacity: 0.62;
          cursor: not-allowed;
          transform: none;
        }

        .ra-switch {
          text-align: center;
          font-size: 12.5px;
          color: var(--muted);
          margin-top: 22px;
        }
        .ra-switch button {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--ink);
          font-weight: 800;
          text-decoration: underline;
          text-underline-offset: 2px;
          font-size: 12.5px;
          font-family: Inter, sans-serif;
          padding: 0;
        }

        .ra-hint {
          font-size: 11.5px;
          color: var(--soft);
          margin: -8px 0 16px 2px;
        }

        /* Modal */
        .ra-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(18, 19, 26, 0.45);
          display: none;
          align-items: center; justify-content: center;
          z-index: 50;
        }
        .ra-modal-overlay.show { display: flex; }
        .ra-modal-box {
          background: #fff;
          border-radius: var(--radius);
          padding: 36px 30px;
          width: 90%; max-width: 300px;
          text-align: center;
          box-shadow: var(--shadow-md);
          border: 1px solid var(--border);
        }
        .ra-spinner {
          width: 34px; height: 34px;
          border-radius: 50%;
          border: 3px solid var(--border-soft);
          border-top-color: #111827;
          margin: 0 auto 18px auto;
          animation: ra-spin 0.9s linear infinite;
        }
        @keyframes ra-spin { to { transform: rotate(360deg); } }
        .ra-modal-msg { font-size: 14.5px; font-weight: 700; color: var(--ink); }
        .ra-check-circle {
          width: 40px; height: 40px; border-radius: 50%;
          background: var(--green);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px auto;
        }

        @media (max-width: 480px) {
          .ra-card { padding: 26px 20px; }
        }
      `}</style>

      <a href="/" className="ra-brand">
        <RefAILogo className="contents" />
      </a>

      <div className="ra-wrap">
        <div className="ra-card">
          {(mode === "signin" || mode === "signup") && (
            <div
              className="ra-role-toggle"
              role="group"
              aria-label="Choose account type"
            >
              <button
                type="button"
                className={role === "student" ? "active" : ""}
                onClick={() => setRole("student")}
              >
                Student
              </button>
              <button
                type="button"
                className={role === "employee" ? "active" : ""}
                onClick={() => setRole("employee")}
              >
                Employee
              </button>
            </div>
          )}

          {(mode === "forgot" || mode === "reset") && (
            <button
              type="button"
              className="ra-back"
              onClick={() => switchMode("signin")}
            >
              ← Back to login
            </button>
          )}

          <div className="ra-head">
            <h1>
              {mode === "signin"
                ? "Welcome back"
                : mode === "signup"
                  ? "Create your account"
                  : mode === "forgot"
                    ? "Reset your password"
                    : "Choose a new password"}
            </h1>
            <p>
              {mode === "signin"
                ? role === "student"
                  ? "Sign in to review your profile, resume evidence, Trust Card, and referral status."
                  : "Sign in to open the candidate queue, verify evidence, and record referral decisions."
                : mode === "signup"
                  ? role === "student"
                    ? "Create a student workspace, then complete your profile and upload a resume."
                    : "Create an employee workspace for candidate reviews and referral decisions."
                  : mode === "forgot"
                    ? "Enter your account email and we’ll send you a secure reset link."
                    : "Use at least 8 characters with uppercase, lowercase, and a number."}
            </p>
          </div>

          {(mode === "signin" || mode === "signup") && (
            <button
              className="ra-oauth-btn"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={oauthLoading || formLoading}
            >
              <svg viewBox="0 0 48 48">
                <path
                  fill="#FFC107"
                  d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.5 29.5 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.4-.3-3.5z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13.5 24 13.5c3.1 0 5.8 1.1 8 3l6-6C34.5 6.5 29.5 4.5 24 4.5c-7.5 0-14 4.2-17.7 10.2z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44.5c5.4 0 10.3-1.8 14-5l-6.5-5.5c-2 1.4-4.6 2.3-7.5 2.3-5.4 0-9.9-3.4-11.5-8.2l-6.6 5.1C9.9 40.2 16.4 44.5 24 44.5z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.5H42V20H24v8h11.3c-1 2.8-2.8 5.1-5.2 6.7l6.5 5.5C40.2 37.4 44.5 31.4 44.5 24c0-1.2-.1-2.4-.3-3.5z"
                />
              </svg>
              {oauthLoading ? "Redirecting…" : "Continue with Google"}
            </button>
          )}

          {oauthError && (
            <div className="ra-error" style={{ marginTop: 10 }} role="alert">
              {oauthError}
            </div>
          )}

          {(mode === "signin" || mode === "signup") && (
            <div className="ra-divider">
              <div className="line" />
              <span>Or continue with email</span>
              <div className="line" />
            </div>
          )}

          {notice && (
            <div className="ra-notice" role="status">
              {notice}
            </div>
          )}

          {mode === "signin" ? (
            <form onSubmit={handleSignIn} noValidate>
              <div className="ra-field">
                <label htmlFor="si-email">Email</label>
                <div className="ra-input-wrap">
                  <input
                    ref={siEmailRef}
                    type="email"
                    id="si-email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="ra-field">
                <label htmlFor="si-password">Password</label>
                <div className="ra-input-wrap">
                  <input
                    ref={siPasswordRef}
                    type={siPwVisible ? "text" : "password"}
                    id="si-password"
                    placeholder="Password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="ra-icon-btn"
                    onClick={() => setSiPwVisible((v) => !v)}
                    aria-label="Toggle password visibility"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="ra-row-between">
                <button
                  type="button"
                  className="ra-forgot"
                  onClick={() => switchMode("forgot")}
                >
                  Forgot password?
                </button>
              </div>

              {siError && <div className="ra-error" role="alert">{siError}</div>}

              <button
                type="submit"
                className="ra-submit"
                disabled={formLoading}
              >
                {formLoading ? "Signing in…" : "Log in"}
              </button>
            </form>
          ) : mode === "signup" ? (
            <form onSubmit={handleSignUp} noValidate>
              <div className="ra-field">
                <label htmlFor="su-name">Full name</label>
                <div className="ra-input-wrap">
                  <input
                    ref={suNameRef}
                    type="text"
                    id="su-name"
                    placeholder="Full name"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              {role === "employee" && (
                <div className="ra-field">
                  <label htmlFor="su-company">Current company</label>
                  <div className="ra-input-wrap">
                    <input
                      ref={suCompanyRef}
                      type="text"
                      id="su-company"
                      placeholder="Company name"
                      autoComplete="organization"
                      maxLength={200}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="ra-field">
                <label htmlFor="su-email">Email</label>
                <div className="ra-input-wrap">
                  <input
                    ref={suEmailRef}
                    type="email"
                    id="su-email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="ra-field">
                <label htmlFor="su-password">Password</label>
                <div className="ra-input-wrap">
                  <input
                    ref={suPasswordRef}
                    type={suPwVisible ? "text" : "password"}
                    id="su-password"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="ra-icon-btn"
                    onClick={() => setSuPwVisible((v) => !v)}
                    aria-label="Toggle password visibility"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="ra-field">
                <label htmlFor="su-confirm">Confirm password</label>
                <div className="ra-input-wrap">
                  <input
                    ref={suConfirmRef}
                    type={suConfirmVisible ? "text" : "password"}
                    id="su-confirm"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="ra-icon-btn"
                    onClick={() => setSuConfirmVisible((v) => !v)}
                    aria-label="Toggle password visibility"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              {suError && <div className="ra-error" role="alert">{suError}</div>}
              {!suError && (
                <div className="ra-hint">
                  8+ characters with uppercase, lowercase, and a number.
                </div>
              )}

              <button
                type="submit"
                className="ra-submit"
                disabled={formLoading}
              >
                {formLoading ? "Creating account…" : "Create account"}
              </button>
            </form>
          ) : mode === "forgot" ? (
            <form onSubmit={handleForgotPassword} noValidate>
              <div className="ra-field">
                <label htmlFor="recovery-email">Email</label>
                <div className="ra-input-wrap">
                  <input
                    ref={recoveryEmailRef}
                    type="email"
                    id="recovery-email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>
              {recoveryError && (
                <div className="ra-error" role="alert">
                  {recoveryError}
                </div>
              )}
              <button
                type="submit"
                className="ra-submit"
                disabled={formLoading}
              >
                {formLoading ? "Sending reset link…" : "Send reset link"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} noValidate>
              <div className="ra-field">
                <label htmlFor="reset-password">New password</label>
                <div className="ra-input-wrap">
                  <input
                    ref={resetPasswordRef}
                    type="password"
                    id="reset-password"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="ra-field">
                <label htmlFor="reset-confirm">Confirm new password</label>
                <div className="ra-input-wrap">
                  <input
                    ref={resetConfirmRef}
                    type="password"
                    id="reset-confirm"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              {recoveryError && (
                <div className="ra-error" role="alert">
                  {recoveryError}
                </div>
              )}
              <button
                type="submit"
                className="ra-submit"
                disabled={formLoading}
              >
                {formLoading ? "Updating password…" : "Update password"}
              </button>
            </form>
          )}

          {(mode === "signin" || mode === "signup") && (
            <div className="ra-switch">
              {mode === "signin" ? (
                <>
                  Don't have an account?{" "}
                  <button type="button" onClick={() => switchMode("signup")}>
                    Create account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button type="button" onClick={() => switchMode("signin")}>
                    Log in
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`ra-modal-overlay ${modalOpen ? "show" : ""}`} role="status" aria-live="polite" aria-hidden={!modalOpen}>
        <div className="ra-modal-box">
          {modalPhase === "loading" ? (
            <>
              <div className="ra-spinner"></div>
              <div className="ra-modal-msg">{modalMsg}</div>
            </>
          ) : (
            <>
              <div className="ra-check-circle">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div className="ra-modal-msg">{modalMsg}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
