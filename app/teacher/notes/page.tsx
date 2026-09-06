"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { getSession, type Session } from "@/lib/session";

// POST /api/notes requires one of these categories.
const CATEGORIES = [
  { value: "logistics", label: "行政事務" },
  { value: "event", label: "活動" },
  { value: "academic", label: "課業" },
  { value: "incident", label: "偶發事件" },
  { value: "emotional", label: "情緒" },
  { value: "habit", label: "生活習慣" },
  { value: "other", label: "其他" },
] as const;

type LocalRecord = { id: string; time: string; studentName: string; body: string };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function NotesPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [studentName, setStudentName] = useState("");
  const [category, setCategory] = useState<string>("logistics");
  const [date, setDate] = useState(todayISO());
  const [body, setBody] = useState("");
  const [history, setHistory] = useState<LocalRecord[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => setSession(getSession()), []);

  const classId = session?.user.classes?.[0]?.id ?? null;
  const canSubmit = !!classId && body.trim().length > 0 && status !== "saving";

  const reset = () => {
    setStudentName("");
    setBody("");
    setCategory("logistics");
    setDate(todayISO());
  };

  async function submit() {
    if (!canSubmit || !session || !classId) return;
    setStatus("saving");
    setErrorMsg("");

    const content = body.trim();
    const namePart = studentName.trim() ? `【${studentName.trim()}】` : "";
    const [, m, d] = date.split("-");
    const datePart = date !== todayISO() ? `（${Number(m)}/${Number(d)}）` : "";
    const fullBody = `${namePart}${datePart}${content}`;

    try {
      // No class-roster endpoint exists, so notes are saved class-scoped.
      // The parent-chat RAG picks them up for any student in this class.
      const res = await api<{ noteId: string }>("/notes", {
        method: "POST",
        token: session.token,
        body: { scope: "class", scopeId: classId, category, body: fullBody },
      });
      setHistory((prev) => [
        {
          id: res.noteId,
          time: `${Number(m)}/${Number(d)}`,
          studentName: studentName.trim() || "全班",
          body: content,
        },
        ...prev,
      ]);
      reset();
      setStatus("ok");
    } catch (e) {
      setErrorMsg(
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "儲存失敗"
      );
      setStatus("error");
    }
  }

  return (
    <div className="px-5 py-6 sm:px-8">
      <h1 className="text-xl font-semibold text-slate-800">記錄學校事項</h1>

      <div className="mt-5 rounded-xl border border-hairline bg-card p-5 sm:p-6">
        <label className="block text-sm font-medium text-slate-700">
          相關學生 <span className="text-xs font-normal text-slate-400">（可留空，會寫進內容供 AI 參考）</span>
        </label>
        <input
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          placeholder="例：王小明"
          className="mt-2 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-parent sm:w-64"
        />

        <label className="mt-6 block text-sm font-medium text-slate-700">類別</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-2 rounded-lg border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-parent"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <label className="mt-6 block text-sm font-medium text-slate-700">日期</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-2 rounded-full border border-hairline bg-white px-4 py-1.5 text-sm outline-none focus:border-parent"
        />

        <label className="mt-6 block text-sm font-medium text-slate-700">事項內容</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="描述今天發生的事…"
          className="mt-2 w-full resize-y rounded-lg border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-parent"
        />

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={`rounded-lg px-5 py-2 text-sm font-medium text-white transition-opacity ${
              canSubmit ? "bg-parent hover:opacity-90" : "cursor-not-allowed bg-slate-300"
            }`}
          >
            {status === "saving" ? "儲存中…" : "提交"}
          </button>
          <button
            onClick={reset}
            className="rounded-lg border border-hairline px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          {status === "ok" && (
            <span className="text-xs text-guidoo-green">已存入資料庫</span>
          )}
          {status === "error" && (
            <span className="text-xs text-urgent">{errorMsg}</span>
          )}
        </div>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-slate-800">歷史紀錄檔案</h2>
      <p className="mt-1 text-xs text-slate-400">
        後端尚無查詢 API，僅顯示這次工作階段新增的紀錄。
      </p>
      <div className="mt-3 overflow-hidden rounded-xl border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-parent">
              <th className="w-28 px-5 py-3 font-medium sm:w-40">時間</th>
              <th className="w-24 px-3 py-3 font-medium sm:w-32">名字</th>
              <th className="px-3 py-3 font-medium">事項內容</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.id} className="border-b border-hairline last:border-0">
                <td className="px-5 py-4 align-top text-slate-400">{r.time}</td>
                <td className="px-3 py-4 align-top font-medium text-slate-700">
                  {r.studentName}
                </td>
                <td className="px-3 py-4 align-top text-slate-700">{r.body}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-slate-400">
                  尚無紀錄
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
