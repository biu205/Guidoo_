"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/sample-data";

type Viewer = "teacher" | "parent";

function isMine(msg: ChatMessage, viewer: Viewer) {
  return viewer === "teacher"
    ? msg.author === "agent" || msg.author === "teacher"
    : msg.author === "parent";
}

/**
 * A message list + composer. Incoming messages sit left in green; the viewer's
 * own messages sit right in gold.
 *
 * - Uncontrolled (no `onSend`): sending just appends a local bubble. Used by
 *   screens still on mock data.
 * - Controlled (`onSend` given): `messages` is the single source of truth and
 *   `send()` delegates to `onSend`; the caller updates `messages` after the
 *   request resolves.
 */
export function ChatThread({
  viewer,
  messages: messagesProp,
  placeholder,
  onSend,
}: {
  viewer: Viewer;
  messages: ChatMessage[];
  placeholder: string;
  onSend?: (text: string) => Promise<void> | void;
}) {
  const controlled = typeof onSend === "function";
  const [localMessages, setLocalMessages] = useState(messagesProp);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const messages = controlled ? messagesProp : localMessages;

  // Uncontrolled: reset when the caller swaps in a different thread.
  useEffect(() => {
    if (!controlled) setLocalMessages(messagesProp);
  }, [messagesProp, controlled]);

  // Keep the newest message in view: on open (messages first arrive) and after
  // every send/refresh, jump the *inner* list to the bottom. Scrolling further
  // up to read history is left to the user.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const sendAccent = viewer === "teacher" ? "bg-parent" : "bg-brand";

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;

    if (controlled) {
      setSending(true);
      setDraft("");
      try {
        await onSend!(text);
      } catch {
        setDraft(text); // put it back so the user doesn't lose the message
      } finally {
        setSending(false);
      }
      return;
    }

    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    setLocalMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        author: viewer === "teacher" ? "teacher" : "parent",
        text,
        time,
      },
    ]);
    setDraft("");
  }

  // Index of the last "mine" message flagged read — that's where 已讀 shows.
  const lastReadIdx = [...messages]
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => isMine(m, viewer) && m.read)
    .map(({ i }) => i)
    .pop();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
      >
        {messages.map((msg, idx) => {
          const mine = isMine(msg, viewer);
          // An AI-agent reply on the viewer's own side gets a distinct look:
          // translucent gold fill, dashed gold outline, gold text + a label.
          const isAgentReply = mine && msg.author === "agent";
          return (
            <div key={msg.id}>
              {isAgentReply && (
                <p className="mb-1 text-right text-xs font-medium text-brand">
                  Agent 回覆
                </p>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    isAgentReply
                      ? "rounded-br-sm border border-dashed border-brand bg-brand/20 text-brand-strong"
                      : mine
                        ? "rounded-br-sm bg-bubble-out text-white"
                        : "rounded-bl-sm bg-bubble-in text-slate-800"
                  }`}
                >
                  {msg.text}
                </p>
              </div>
              {idx === lastReadIdx && (
                <p className="mt-1 text-right text-xs text-slate-400">
                  已讀 {msg.time}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-hairline bg-card px-4 py-3 sm:px-6">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={sending}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-parent disabled:opacity-60"
        />
        <button
          onClick={send}
          disabled={sending}
          className={`shrink-0 rounded-lg px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60 ${sendAccent}`}
        >
          {sending ? "傳送中…" : "送出"}
        </button>
      </div>
    </div>
  );
}
