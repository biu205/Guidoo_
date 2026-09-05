"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { ChatThread } from "@/components/chat-thread";
import { SAMPLE_CONVERSATIONS } from "@/lib/sample-data";

export default function TeacherChatPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A `?c=<id>` param (e.g. from a dashboard card) preselects that thread on
  // any viewport; otherwise desktop lands on the first thread and mobile on
  // the list (per Figma).
  useEffect(() => {
    const fromParam = new URLSearchParams(window.location.search).get("c");
    if (fromParam && SAMPLE_CONVERSATIONS.some((c) => c.id === fromParam)) {
      setSelectedId(fromParam);
    } else if (window.matchMedia("(min-width: 768px)").matches) {
      setSelectedId(SAMPLE_CONVERSATIONS[0]?.id ?? null);
    }
  }, []);

  const list = SAMPLE_CONVERSATIONS;
  const selected = SAMPLE_CONVERSATIONS.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* header row */}
      <div
        className={`px-5 pt-6 pb-3 sm:px-8 ${selected ? "hidden md:block" : "block"}`}
      >
        <h1 className="text-xl font-semibold text-slate-800">與家長的聊天</h1>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 px-3 pb-4 sm:px-6">
        {/* conversation list */}
        <ul
          className={`w-full shrink-0 space-y-2 overflow-y-auto rounded-xl border border-hairline bg-card p-2 md:flex md:w-[340px] md:flex-col ${
            selected ? "hidden md:block" : "block"
          }`}
        >
          {list.map((c) => {
            const active = c.id === selectedId;
            return (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border-l-4 px-3 py-3 text-left transition-colors ${
                    active
                      ? "border-l-guidoo-green bg-bubble-in/50"
                      : "border-l-transparent hover:bg-slate-50"
                  }`}
                >
                  <Avatar initial={c.initial} size="md" tone="slate" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-800">
                        {c.parentName}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">{c.time}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{c.preview}</p>
                  </div>
                </button>
              </li>
            );
          })}
          {list.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-400">找不到對話</li>
          )}
        </ul>

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
                <Avatar initial={selected.initial} size="md" tone="slate" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {selected.parentName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selected.className} · 最後回覆 {selected.lastReplyTime}
                  </p>
                </div>
                {selected.urgent && (
                  <span className="shrink-0 rounded-full bg-urgent px-3 py-1 text-xs font-medium text-white">
                    緊急
                  </span>
                )}
              </div>
              <ChatThread
                key={selected.id}
                viewer="teacher"
                messages={selected.messages}
                placeholder="輸入訊息…"
              />
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
