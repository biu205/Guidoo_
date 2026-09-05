"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { ChatThread } from "@/components/chat-thread";
import { api, ApiError } from "@/lib/api";
import { getSession, clearSession, type Session } from "@/lib/session";
import type { ChatMessage } from "@/lib/sample-data";

type ApiThread = {
  studentId: string;
  studentName: string;
  parentNames: string | null;
  lastMessage: string;
  lastMessageRole: "parent" | "assistant" | "teacher";
  lastMessageAt: string;
  openEscalations: number;
};

type ApiMessage = {
  id: string;
  role: "parent" | "assistant" | "teacher";
  content: string;
  status: string | null;
  createdAt: string;
  authorTeacherId: string | null;
  authorTeacherName: string | null;
};

function fmtClock(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const hhmm = d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === now.toDateString()) return hhmm;
  const yst = new Date(now);
  yst.setDate(now.getDate() - 1);
  if (d.toDateString() === yst.toDateString()) return "昨天";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function toChatMessages(rows: ApiMessage[]): ChatMessage[] {
  return rows.map((m) => ({
    id: m.id,
    author: m.role === "assistant" ? "agent" : m.role,
    text: m.content,
    time: fmtClock(m.createdAt),
  }));
}

export default function TeacherChatPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [threads, setThreads] = useState<ApiThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [threadState, setThreadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const onAuthError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        router.replace("/login");
        return true;
      }
      return false;
    },
    [router]
  );

  const loadThreads = useCallback(
    async (token: string, classId: string): Promise<ApiThread[]> => {
      const res = await api<{ threads: ApiThread[] }>(`/chat/threads?classId=${classId}`, { token });
      setThreads(res.threads);
      return res.threads;
    },
    []
  );

  const loadThread = useCallback(
    async (token: string, studentId: string) => {
      setThreadState("loading");
      try {
        const res = await api<{ messages: ApiMessage[] }>(
          `/chat/history?studentId=${studentId}`,
          { token }
        );
        setMessages(toChatMessages(res.messages));
        setThreadState("ready");
      } catch (e) {
        if (onAuthError(e)) return;
        setErrorMsg(e instanceof Error ? e.message : "載入對話失敗");
        setThreadState("error");
      }
    },
    [onAuthError]
  );

  // Initial load: fetch the class's conversation list, then preselect a thread
  // (a `?c=<studentId>` param wins; otherwise desktop lands on the first row
  // and mobile on the list, per Figma).
  useEffect(() => {
    const s = getSession();
    if (!s || s.user.role !== "teacher" || !s.user.classes?.[0]) {
      router.replace("/login");
      return;
    }
    setSession(s);
    const classId = s.user.classes[0].id;
    (async () => {
      setListState("loading");
      try {
        const list = await loadThreads(s.token, classId);
        setListState("ready");
        const fromParam = new URLSearchParams(window.location.search).get("c");
        if (fromParam && list.some((t) => t.studentId === fromParam)) {
          setSelectedId(fromParam);
        } else if (window.matchMedia("(min-width: 768px)").matches) {
          setSelectedId(list[0]?.studentId ?? null);
        }
      } catch (e) {
        if (onAuthError(e)) return;
        setErrorMsg(e instanceof Error ? e.message : "載入失敗");
        setListState("error");
      }
    })();
  }, [router, loadThreads, onAuthError]);

  // Fetch the thread body whenever the selection changes.
  useEffect(() => {
    if (!session || !selectedId) {
      setMessages([]);
      setThreadState("idle");
      return;
    }
    loadThread(session.token, selectedId);
  }, [session, selectedId, loadThread]);

  const selected = threads.find((t) => t.studentId === selectedId) ?? null;
  const className = session?.user.classes?.[0]?.name ?? "";

  async function handleSend(text: string) {
    if (!session || !selectedId) return;
    await api("/chat", {
      method: "POST",
      token: session.token,
      body: { studentId: selectedId, message: text },
    });
    await loadThread(session.token, selectedId);
    // Refresh the list so the preview + ordering catch up (best-effort).
    if (session.user.classes?.[0]) {
      loadThreads(session.token, session.user.classes[0].id).catch(() => {});
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* header row */}
      <div className={`px-5 pt-6 pb-3 sm:px-8 ${selected ? "hidden md:block" : "block"}`}>
        <h1 className="text-xl font-semibold text-slate-800">與家長的聊天</h1>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 px-3 pb-4 sm:px-6">
        {/* conversation list */}
        <div
          className={`w-full shrink-0 overflow-y-auto rounded-xl border border-hairline bg-card p-2 md:flex md:w-[340px] md:flex-col ${
            selected ? "hidden md:block" : "block"
          }`}
        >
          {listState === "loading" && (
            <p className="px-3 py-6 text-center text-sm text-slate-400">載入中…</p>
          )}
          {listState === "error" && (
            <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <p className="text-sm text-urgent">{errorMsg}</p>
              <Link href="/login" className="text-sm text-parent underline">
                重新登入
              </Link>
            </div>
          )}
          {listState === "ready" && threads.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-400">目前沒有家長對話</p>
          )}
          {listState === "ready" && threads.length > 0 && (
            <ul className="space-y-2">
              {threads.map((t) => {
                const active = t.studentId === selectedId;
                return (
                  <li key={t.studentId}>
                    <button
                      onClick={() => setSelectedId(t.studentId)}
                      className={`flex w-full items-center gap-3 rounded-lg border-l-4 px-3 py-3 text-left transition-colors ${
                        active
                          ? "border-l-guidoo-green bg-bubble-in/50"
                          : "border-l-transparent hover:bg-slate-50"
                      }`}
                    >
                      <Avatar initial={t.studentName[0]} size="md" tone="slate" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-slate-800">
                            {t.parentNames || `${t.studentName} 家長`}
                          </span>
                          <span className="shrink-0 text-xs text-slate-400">
                            {fmtClock(t.lastMessageAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {t.lastMessageRole === "parent" ? "" : "我方："}
                          {t.lastMessage}
                        </p>
                      </div>
                      {t.openEscalations > 0 && (
                        <span className="shrink-0 rounded-full bg-urgent px-2 py-0.5 text-[10px] font-medium text-white">
                          待處理
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* thread */}
        <section
          className={`min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-hairline bg-card ${
            selected ? "flex" : "hidden md:flex"
          }`}
        >
          {selected ? (
            <>
              <div className="flex items-center gap-3 border-b border-hairline px-4 py-3 sm:px-6">
                <button
                  aria-label="返回"
                  onClick={() => setSelectedId(null)}
                  className="-ml-1 p-1 text-slate-500 md:hidden"
                >
                  <IconBack />
                </button>
                <Avatar initial={selected.studentName[0]} size="md" tone="slate" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {selected.parentNames || `${selected.studentName} 家長`}
                  </p>
                  <p className="text-xs text-slate-400">
                    {[className, `學生 ${selected.studentName}`, `最後回覆 ${fmtClock(selected.lastMessageAt)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {selected.openEscalations > 0 && (
                  <span className="shrink-0 rounded-full bg-urgent px-3 py-1 text-xs font-medium text-white">
                    待處理
                  </span>
                )}
              </div>

              {threadState === "loading" && (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                  載入對話中…
                </div>
              )}
              {threadState === "error" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm text-urgent">{errorMsg}</p>
                  <button
                    onClick={() => session && loadThread(session.token, selected.studentId)}
                    className="text-sm text-parent underline"
                  >
                    重新載入
                  </button>
                </div>
              )}
              {threadState === "ready" && (
                <ChatThread
                  key={selected.studentId}
                  viewer="teacher"
                  messages={messages}
                  placeholder="輸入訊息…"
                  onSend={handleSend}
                />
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              選擇一則對話開始
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function IconBack() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
