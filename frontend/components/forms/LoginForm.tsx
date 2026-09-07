"use client";

/**
 * LoginForm — Reusable login form component.
 *
 * Design decisions:
 * - React Hook Form + zodResolver for validation: avoids re-renders on every
 *   keystroke (RHF is uncontrolled by default) while giving type-safe errors.
 * - CSRF token is fetched on mount via GET /csrf-token so the Axios interceptor
 *   has a token ready before the first submit. This is transparent to the user.
 * - Accessible: all inputs have explicit <label> elements, error messages use
 *   role="alert" + aria-live="polite", focus rings use custom Tailwind ring
 *   utilities scoped to the Ferrari Red palette.
 * - No "Forgot password" or "Sign up" links — RIDSS accounts are admin-provisioned.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Clock, Eye, EyeOff, Lock, Loader2, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { fetchCsrfToken } from "@/features/auth/api/authApi";
import { useLogin } from "@/features/auth/hooks/useLogin";
import { loginSchema, type LoginPayload } from "@/features/auth/schemas/loginSchema";

// ── Sub-component: field-level error ─────────────────────────────────────────

function FieldError({ message, id }: { message: string; id: string }) {
  return (
    <motion.p
      id={id}
      role="alert"
      aria-live="polite"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-400"
    >
      <AlertCircle size={12} aria-hidden="true" />
      {message}
    </motion.p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  const { mutate: login, isPending, error, isSuccess } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginPayload>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit", // Only validate on submit — don't nag while typing
    reValidateMode: "onChange",
  });

  // Bootstrap CSRF token on mount so Axios interceptor is primed
  useEffect(() => {
    fetchCsrfToken().catch(() => {
      // Non-fatal — if this fails the submit will fail and user will see an error
    });
  }, []);

  // Cooldown countdown timer (rate-limit UX)
  useEffect(() => {
    if (error?.retryAfter) {
      setCooldown(error.retryAfter);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      cooldownRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [error?.retryAfter]);

  const onSubmit = (data: LoginPayload) => {
    if (isPending || cooldown > 0 || isSuccess) return;
    login(data);
  };

  const isDisabled = isPending || cooldown > 0 || isSuccess;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Sign in to RIDSS"
      className="w-full space-y-5"
    >
      {/* ── Email ──────────────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400"
        >
          Email Address
        </label>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-500"
          >
            <Mail size={16} />
          </span>
          <input
            id="email"
            type="email"
            autoComplete="username"
            spellCheck={false}
            autoCapitalize="off"
            aria-required="true"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={`
              w-full rounded-lg border bg-graphite-800 py-3 pl-10 pr-4 text-sm text-slate-100
              placeholder-slate-600 transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-ferrari-red focus:ring-offset-2
              focus:ring-offset-graphite-900
              ${errors.email
                ? "border-amber-500/60 bg-amber-500/5"
                : "border-slate-700 hover:border-slate-500 focus:border-transparent"
              }
              disabled:cursor-not-allowed disabled:opacity-50
            `}
            placeholder="engineer@ridss.team"
            disabled={isDisabled}
            {...register("email")}
          />
        </div>
        <AnimatePresence mode="wait">
          {errors.email?.message && (
            <FieldError id="email-error" message={errors.email.message} />
          )}
        </AnimatePresence>
      </div>

      {/* ── Password ───────────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400"
        >
          Password
        </label>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-500"
          >
            <Lock size={16} />
          </span>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            aria-required="true"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            className={`
              w-full rounded-lg border bg-graphite-800 py-3 pl-10 pr-12 text-sm text-slate-100
              placeholder-slate-600 transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-ferrari-red focus:ring-offset-2
              focus:ring-offset-graphite-900
              ${errors.password
                ? "border-amber-500/60 bg-amber-500/5"
                : "border-slate-700 hover:border-slate-500 focus:border-transparent"
              }
              disabled:cursor-not-allowed disabled:opacity-50
            `}
            placeholder="••••••••••••"
            disabled={isDisabled}
            {...register("password")}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-3 flex items-center text-slate-500
                       transition-colors hover:text-slate-300 focus:outline-none
                       focus-visible:ring-2 focus-visible:ring-ferrari-red
                       focus-visible:ring-offset-1 focus-visible:ring-offset-graphite-900
                       rounded"
            tabIndex={0}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <AnimatePresence mode="wait">
          {errors.password?.message && (
            <FieldError id="password-error" message={errors.password.message} />
          )}
        </AnimatePresence>
      </div>

      {/* ── Server / rate-limit error ───────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            role="alert"
            aria-live="assertive"
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.2 }}
            className={`
              flex items-start gap-3 rounded-lg border p-3.5 text-sm
              ${cooldown > 0
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
              }
            `}
          >
            {cooldown > 0 ? (
              <Clock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span>
              {cooldown > 0
                ? `Account locked. Try again in ${cooldown}s.`
                : error.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Submit button ───────────────────────────────────────────────── */}
      <button
        id="login-submit"
        type="submit"
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={isPending}
        className={`
          group relative w-full overflow-hidden rounded-lg py-3.5 text-sm font-semibold
          tracking-wide text-white transition-all duration-300
          focus:outline-none focus-visible:ring-2 focus-visible:ring-ferrari-red
          focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-900
          disabled:cursor-not-allowed disabled:opacity-60
          ${!isDisabled
            ? "bg-ferrari-red hover:bg-ferrari-red/90 hover:shadow-lg hover:shadow-ferrari-red/25 active:scale-[0.98]"
            : "bg-ferrari-red/60"
          }
        `}
      >
        {/* Shimmer effect on idle */}
        {!isDisabled && (
          <span
            aria-hidden="true"
            className="absolute inset-0 -skew-x-12 translate-x-[-150%] bg-white/10
                       transition-transform duration-700 group-hover:translate-x-[200%]"
          />
        )}
        <span className="relative flex items-center justify-center gap-2">
          {isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Authenticating…
            </>
          ) : isSuccess ? (
            <>Redirecting…</>
          ) : cooldown > 0 ? (
            <>
              <Clock size={16} aria-hidden="true" />
              Wait {cooldown}s
            </>
          ) : (
            "Sign In"
          )}
        </span>
      </button>

      {/* ── No forgot password / sign up — intentionally omitted ────────── */}
      {/* This is an enterprise app. All accounts are admin-provisioned.      */}
      {/* Contact your system administrator to reset credentials.              */}
      <p className="text-center text-xs text-slate-600">
        Access issues?{" "}
        <span className="text-slate-500">Contact your system administrator.</span>
      </p>
    </form>
  );
}
