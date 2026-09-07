"use client";

/**
 * LoginPageClient — Full-page login UI with Framer Motion entrance animation.
 *
 * Design: Dark Engineering Theme
 *   Background: Deep Graphite (#0D0D0F) with subtle animated grid
 *   Card: Dark Slate surface with glass border
 *   Accent: Ferrari Red (#DC143C)
 *   Warning: Amber (#F59E0B)
 *
 * Judgment call: We check /me on mount and redirect if already authenticated.
 * This prevents the login page from flashing for users who are already logged
 * in and navigate back to /login (e.g. via browser back button).
 * We do NOT use Next.js cookies() here because this is a client component —
 * the httpOnly cookie is not JS-readable, so we rely on the /me API call.
 */

import { motion } from "framer-motion";
import { Activity, ChevronRight, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { LoginForm } from "@/components/forms/LoginForm";
import { fetchMe } from "@/features/auth/api/authApi";
import { getRouteForRole } from "@/features/auth/schemas/loginSchema";

// ── Framer Motion variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
} as const;

// ── Role display metadata ─────────────────────────────────────────────────────
const ROLES_DISPLAY = [
  "Administrator",
  "Team Manager",
  "Race Engineer",
  "Strategy Engineer",
  "Mechanic",
  "Driver",
];

export default function LoginPageClient() {
  const router = useRouter();

  // Redirect already-authenticated users
  useEffect(() => {
    fetchMe()
      .then((user) => {
        const route = getRouteForRole(user.role);
        if (route) router.replace(route);
      })
      .catch(() => {
        // Not authenticated — stay on login page
      });
  }, [router]);


  return (
    <main
      className="relative min-h-screen overflow-hidden bg-graphite flex items-center justify-center p-4"
      aria-labelledby="login-heading"
    >
      {/* ── Animated background grid ──────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px]"
      />

      {/* ── Glowing accent orbs ───────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 -left-48 h-96 w-96 rounded-full bg-ferrari-red/8 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -right-48 h-96 w-96 rounded-full bg-ferrari-red/5 blur-3xl"
      />

      {/* ── Main card ─────────────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-2xl border border-slate-800/60 bg-slate-surface shadow-2xl shadow-black/60 backdrop-blur-sm">

          {/* ── Ferrari Red top bar ───────────────────────────────────────── */}
          <div className="h-0.5 w-full rounded-t-2xl bg-gradient-to-r from-transparent via-ferrari-red to-transparent" />

          <div className="p-8 sm:p-10">
            {/* ── Logo + Branding ───────────────────────────────────────── */}
            <motion.div variants={itemVariants} className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ferrari-red/15 ring-1 ring-ferrari-red/30">
                <Activity size={20} className="text-ferrari-red" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold tracking-tight text-slate-100">RIDSS</span>
                  <span className="rounded-sm bg-ferrari-red/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-ferrari-red ring-1 ring-ferrari-red/20">
                    v1
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 tracking-wide">
                  Race Intelligence Decision Support
                </p>
              </div>
            </motion.div>

            {/* ── Heading ───────────────────────────────────────────────── */}
            <motion.div variants={itemVariants} className="mb-8">
              <h1
                id="login-heading"
                className="text-2xl font-bold tracking-tight text-slate-100"
              >
                Secure Access
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Authenticate with your team credentials to continue.
              </p>
            </motion.div>

            {/* ── Form ──────────────────────────────────────────────────── */}
            <motion.div variants={itemVariants}>
              <LoginForm />
            </motion.div>
          </div>

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <motion.div
            variants={itemVariants}
            className="border-t border-slate-800/50 px-8 py-5 sm:px-10"
          >
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Shield size={11} aria-hidden="true" />
              <span>Protected by JWT · httpOnly cookies · Strict CSP</span>
            </div>
          </motion.div>
        </div>

        {/* ── Role indicator strip ─────────────────────────────────────── */}
        <motion.div
          variants={itemVariants}
          className="mt-4 flex flex-wrap items-center justify-center gap-1.5"
          aria-label="Authorized user roles"
        >
          {ROLES_DISPLAY.map((role) => (
            <span
              key={role}
              className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[10px] text-slate-600 backdrop-blur-sm"
            >
              <ChevronRight size={8} aria-hidden="true" className="text-ferrari-red/60" />
              {role}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </main>
  );
}
