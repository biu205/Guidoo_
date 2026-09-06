"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { api } from "@/lib/api";
import { saveSession, type Session } from "@/lib/session";

// Demo accounts (see .env.local) — the chips below just fill the fields; the
// user still submits the form.
const DEMO_ACCOUNTS = [
  {
    label: "老師",
    email: process.env.NEXT_PUBLIC_DEMO_TEACHER_EMAIL ?? "teacher.chen@example.tw",
    password: process.env.NEXT_PUBLIC_DEMO_TEACHER_PASSWORD ?? "demo1234",
  },
  {
    label: "家長",
    email: process.env.NEXT_PUBLIC_DEMO_PARENT_EMAIL ?? "parent10@example.tw",
    password: process.env.NEXT_PUBLIC_DEMO_PARENT_PASSWORD ?? "demo1234",
  },
];

function landingFor(role: string) {
  return role === "teacher" ? "/teacher/dashboard" : "/parent/chat";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !pending && email.trim().length > 0 && password.length > 0;

  async function signIn(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);
    try {
      const session = await api<Session>("/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
      });
      saveSession(session);
      router.push(landingFor(session.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "登入失敗，請稍後再試");
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-md rounded-2xl bg-card px-8 py-12 shadow-sm sm:px-12">
        <div className="flex flex-col items-center text-center">
          <Wordmark className="text-4xl" />
          <p className="mt-6 text-sm text-slate-700">為台灣教室裡的溝通而生</p>
          <p className="mt-1 text-xs text-slate-500">AI 橋樑 · 連接家長、老師、學生</p>
        </div>

        <form onSubmit={signIn} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              帳號
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.tw"
              className="mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-parent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              密碼
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-parent"
            />
          </div>

          {error && <p className="text-xs text-urgent">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "登入中…" : "登入"}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
          <span>示範帳號：</span>
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                setEmail(a.email);
                setPassword(a.password);
                setError(null);
              }}
              className="rounded-full border border-hairline px-3 py-1 text-slate-600 hover:bg-slate-50"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
