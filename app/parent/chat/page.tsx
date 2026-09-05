"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { ChatThread } from "@/components/chat-thread";
import { api, ApiError } from "@/lib/api";
import { getSession, clearSession, type Session } from "@/lib/session";
import type { ChatMessage } from "@/lib/sample-data";

type ApiMessage = {
  id: string;
  role: "parent" | "assistant" | "teacher";
  content: string;
  status: string | null;
  createdAt: string;
  authorTeacherName: string | null;
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const hhmm = d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === today.toDateString()) return hhmm;
  return `${d.getMonth() + 1}/${d.getDate()} ${hhmm}`;
}

function toChatMessages(rows: ApiMessage[]): ChatMessage[] {
  return rows.map((m, i) => ({
    id: m.id,
    author: m.role === "assistant" ? "agent" : m.role,
    text: m.content,
    time: fmtTime(m.createdAt),
    // mark the last parent turn as read once something follows it
    read: m.role === "parent" && i < rows.length - 1,
  }));
}

export default function ParentChatPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const student = session?.user.students?.[0];

  const load = useCallback(
    async (token: string, studentId: string) => {
      try {
        const res = await api<{ messages: ApiMessage[] }>(
          `/chat/history?studentId=${studentId}`,
          { token }
        );
        setMessages(toChatMessages(res.messages));
        setState("ready");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          clearSession();
          router.replace("/login");
          return;
        }
        setErrorMsg(e instanceof Error ? e.message : "載入失敗");
        setState("error");
      }
    },
    [router]
  );

  useEffect(() => {
    const s = getSession();
    if (!s || s.user.role !== "parent" || !s.user.students?.[0]) {
      router.replace("/login");
      return;
    }
    setSession(s);
    load(s.token, s.user.students[0].id);
  }, [router, load]);

  async function handleSend(text: string) {
    if (!session || !student) return;
    await api("/chat", {
      method: "POST",
      token: session.token,
      body: { studentId: student.id, message: text },
    });
    await load(session.token, student.id);
  }

  // No parent-facing endpoint exposes the teacher's name, so keep it generic.
  const headerName = "老師";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <Link
          href="/login"
          aria-label="返回"
          onClick={() => clearSession()}
          className="-ml-1 shrink-0 p-1 text-slate-500 hover:text-slate-700"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <Avatar initial={headerName[0]} size="lg" tone="slate" />
        <div>
          <p className="text-sm font-semibold text-slate-800">{headerName}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {student ? `${student.name} · 親師對話` : "親師對話"}
          </p>
        </div>
      </div>

      {state === "loading" && (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          載入中…
        </div>
      )}
      {state === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-urgent">{errorMsg}</p>
          <Link href="/login" className="text-sm text-parent underline">
            重新登入
          </Link>
        </div>
      )}
      {state === "ready" && (
        <ChatThread
          viewer="parent"
          messages={messages}
          placeholder="回覆老師…"
          onSend={handleSend}
        />
      )}
    </div>
  );
}
