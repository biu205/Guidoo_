"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { api } from "@/lib/api";
import { saveSession, type Session } from "@/lib/session";

// The Figma login screen is a role picker only — no credentials. Each button
// signs in with a hardcoded demo account (see .env.local) and routes on.
const DEMO = {
  teacher: {
    email: process.env.NEXT_PUBLIC_DEMO_TEACHER_EMAIL ?? "teacher.chen@example.tw",
    password: process.env.NEXT_PUBLIC_DEMO_TEACHER_PASSWORD ?? "demo1234",
    next: "/teacher/dashboard",
  },
  parent: {
    email: process.env.NEXT_PUBLIC_DEMO_PARENT_EMAIL ?? "parent10@example.tw",
    password: process.env.NEXT_PUBLIC_DEMO_PARENT_PASSWORD ?? "demo1234",
    next: "/parent/chat",
  },
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState<null | "teacher" | "parent">(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(role: "teacher" | "parent") {
    setError(null);
    setPending(role);
    try {
      const { email, password, next } = DEMO[role];
      const session = await api<Session>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      saveSession(session);
      router.push(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登入失敗，請稍後再試");
      setPending(null);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-md rounded-2xl bg-card px-8 py-14 shadow-sm sm:px-12">
        <div className="flex flex-col items-center text-center">
          <Wordmark className="text-4xl" />
          <p className="mt-6 text-sm text-slate-700">為台灣教室裡的溝通而生</p>
          <p className="mt-1 text-xs text-slate-500">AI 橋樑 · 連接家長、老師、學生</p>

          <div className="mt-8 grid w-full grid-cols-2 gap-4">
            <button
              onClick={() => signIn("teacher")}
              disabled={pending !== null}
              className="rounded-lg bg-brand px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending === "teacher" ? "登入中…" : "我是老師"}
            </button>
            <button
              onClick={() => signIn("parent")}
              disabled={pending !== null}
              className="rounded-lg bg-parent px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending === "parent" ? "登入中…" : "我是家長"}
            </button>
          </div>

          {error && <p className="mt-4 text-xs text-urgent">{error}</p>}
        </div>
      </div>
    </main>
  );
}
