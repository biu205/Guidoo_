"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getSession, clearSession, type Session } from "@/lib/session";
import { SAMPLE_EVENTS, SAMPLE_CALENDAR_MONTH } from "@/lib/sample-data";

type Priority = "urgent" | "watch" | "info";

type ApiEscalation = {
  id: string;
  studentName: string;
  question: string | null;
  score: string | number;
  createdAt: string;
  legalFlag: boolean;
  legalCategory: string | null;
};

type Task = {
  id: string;
  studentName: string;
  summary: string;
  time: string;
  priority: Priority;
  done: boolean;
};

// The Figma card is a plain rounded white box; the priority colour is a short
// vertical line sitting *inside* it near the left edge — not a card border.
const LINE: Record<Priority, string> = {
  urgent: "bg-urgent",
  watch: "bg-watch",
  info: "bg-parent",
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const hhmm = d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === today.toDateString()) return hhmm;
  const yst = new Date(today);
  yst.setDate(today.getDate() - 1);
  if (d.toDateString() === yst.toDateString()) return "昨天";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function priorityOf(e: ApiEscalation): Priority {
  const score = Number(e.score) || 0;
  if (e.legalFlag || score >= 3) return "urgent";
  if (score === 2) return "watch";
  return "info";
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(
    async (token: string, classId: string) => {
      try {
        const res = await api<{ recentEscalations: ApiEscalation[] }>(
          `/dashboard?classId=${classId}`,
          { token }
        );
        setTasks(
          res.recentEscalations.map((e) => ({
            id: e.id,
            studentName: e.studentName,
            summary: (e.question ?? "（無內容）").trim(),
            time: fmtTime(e.createdAt),
            priority: priorityOf(e),
            done: false,
          }))
        );
        setState("ready");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          router.replace("/login");
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : "載入失敗");
        setState("error");
      }
    },
    [router]
  );

  useEffect(() => {
    const s = getSession();
    if (!s || s.user.role !== "teacher" || !s.user.classes?.[0]) {
      router.replace("/login");
      return;
    }
    setSession(s);
    load(s.token, s.user.classes[0].id);
  }, [router, load]);

  async function resolve(id: string) {
    if (!session) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: true } : t)));
    try {
      await api(`/escalations/${id}/resolve`, { method: "POST", token: session.token });
    } catch {
      // revert on failure
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: false } : t)));
    }
  }

  return (
    <div className="flex flex-col md:flex-row">
      <section className="min-w-0 flex-1 px-5 py-6 sm:px-8">
        <h1 className="text-xl font-semibold text-slate-800">今日待處理</h1>

        {state === "loading" && (
          <p className="mt-6 text-sm text-slate-400">載入中…</p>
        )}
        {state === "error" && (
          <div className="mt-6 flex flex-col items-start gap-2">
            <p className="text-sm text-urgent">{errorMsg}</p>
            <Link href="/login" className="text-sm text-parent underline">
              重新登入
            </Link>
          </div>
        )}
        {state === "ready" && tasks.length === 0 && (
          <p className="mt-6 text-sm text-slate-400">目前沒有待處理的家長訊息。</p>
        )}

        {state === "ready" && tasks.length > 0 && (
          <ul className="mt-5 space-y-3">
            {tasks.map((task) => (
              <li
                key={task.id}
                className={`relative rounded-xl p-4 pl-9 ${
                  task.done
                    ? "border border-hairline bg-slate-100"
                    : "bg-card shadow-sm"
                }`}
              >
                <span
                  className={`absolute top-4 bottom-4 left-3.5 w-[3px] rounded-full ${
                    task.done ? "bg-slate-300" : LINE[task.priority]
                  }`}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={`text-base ${
                          task.done ? "text-slate-400" : "text-slate-700"
                        }`}
                      >
                        {task.studentName}
                      </p>
                      <span className="shrink-0 text-xs text-slate-400 sm:hidden">
                        {task.time}
                      </span>
                    </div>
                    <p
                      className={`mt-1 text-base font-semibold whitespace-pre-wrap ${
                        task.done ? "text-slate-400" : "text-slate-900"
                      }`}
                    >
                      {task.summary}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-3 sm:shrink-0 sm:flex-col sm:items-end">
                    <span className="hidden text-xs text-slate-400 sm:block">
                      {task.time}
                    </span>
                    <button
                      disabled={task.done}
                      onClick={() => resolve(task.id)}
                      className={`rounded-full px-6 py-1.5 text-sm font-medium transition-opacity ${
                        task.done
                          ? "cursor-default bg-slate-200 text-slate-400"
                          : "bg-bubble-in text-green-800 hover:opacity-90"
                      }`}
                    >
                      處理完畢
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 行事曆 — no backend endpoint yet, still sample data */}
      <aside className="shrink-0 bg-parent px-5 py-6 text-white sm:px-6 md:w-[360px]">
        <h2 className="text-lg font-semibold">行事曆</h2>
        <CalendarCard />
        <EventList />
      </aside>
    </div>
  );
}

function CalendarCard() {
  const { year, month } = SAMPLE_CALENDAR_MONTH;
  const highlighted = useMemo(
    () =>
      new Set(
        SAMPLE_EVENTS.filter((e) => {
          const d = new Date(e.date);
          return d.getFullYear() === year && d.getMonth() + 1 === month;
        }).map((e) => new Date(e.date).getDate())
      ),
    [year, month]
  );

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="mt-4 rounded-xl bg-white p-4 text-slate-700">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">
          {year} 年 {month} 月
        </span>
        <span className="text-xs text-slate-400">
          {highlighted.size} 個重要日期
        </span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-y-2 text-center text-xs text-slate-400">
        {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1.5 text-center text-sm">
        {cells.map((day, i) => (
          <div key={i} className="flex items-center justify-center">
            {day && (
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  highlighted.has(day)
                    ? "bg-[#bfe3a3] font-medium text-green-900"
                    : "text-slate-600"
                }`}
              >
                {day}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EventList() {
  return (
    <ul className="mt-4 space-y-4 rounded-xl bg-parent-soft p-4 text-slate-700">
      {SAMPLE_EVENTS.map((e) => (
        <li key={e.date} className="flex gap-3 text-sm">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
          <div>
            <p>
              <span className="font-semibold">{e.label}</span>
              <span className="ml-3">{e.title}</span>
            </p>
            {e.detail && <p className="mt-0.5 text-xs text-slate-500">{e.detail}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
