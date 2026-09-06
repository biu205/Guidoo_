"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { Avatar } from "@/components/avatar";
import { getSession, clearSession } from "@/lib/session";

const NAV = [
  { href: "/teacher/dashboard", label: "總表", icon: IconList },
  { href: "/teacher/chat", label: "聊天室", icon: IconChat },
  { href: "/teacher/notes", label: "填寫事項", icon: IconPencil },
];

export default function TeacherLayout({ children }: LayoutProps<"/teacher">) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [t, setT] = useState({ name: "老師", initial: "師", className: "" });
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  function switchIdentity() {
    clearSession();
    router.push("/login");
  }

  useEffect(() => {
    const s = getSession();
    if (!s || s.user.role !== "teacher") {
      router.replace("/login");
      return;
    }
    setT({
      name: s.user.name,
      initial: s.user.name.slice(0, 1),
      className: s.user.classes?.[0]?.name ?? "",
    });
  }, [router]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-card md:flex">
        <div className="px-6 py-5">
          <Wordmark className="text-2xl" />
        </div>
        <nav className="mt-2 flex flex-col">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-6 py-3.5 text-sm transition-colors ${
                isActive(item.href)
                  ? "bg-parent font-medium text-white"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          onClick={switchIdentity}
          className="mt-auto border-t border-hairline px-6 py-4 text-left text-sm text-slate-500 transition-colors hover:bg-slate-50"
        >
          切換身分
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop top bar */}
        <header className="hidden shrink-0 items-center gap-3 border-b border-hairline bg-card px-8 py-4 md:flex">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            {t.className && <span>{t.className}</span>}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm font-medium text-slate-800">{t.name}</span>
            <Avatar initial={t.initial} size="sm" tone="slate" />
            <button
              onClick={switchIdentity}
              className="rounded-full border border-hairline px-3 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50"
            >
              切換身分
            </button>
          </div>
        </header>

        {/* Mobile top bar */}
        <header className="flex shrink-0 items-center justify-between border-b border-hairline bg-card px-4 py-3 md:hidden">
          <button
            aria-label="選單"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 p-1 text-slate-700"
          >
            <IconMenu />
          </button>
          <Wordmark className="text-xl" />
          <Avatar initial={t.initial} size="sm" tone="slate" />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>

        {/* Mobile bottom tabs */}
        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-hairline bg-card md:hidden">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs ${
                  active ? "text-brand" : "text-slate-500"
                }`}
              >
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute inset-y-0 left-0 w-64 bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Wordmark className="text-2xl" />
            <nav className="mt-6 flex flex-col">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`rounded-lg px-3 py-3 text-sm ${
                    isActive(item.href)
                      ? "bg-parent font-medium text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              onClick={() => {
                setDrawerOpen(false);
                switchIdentity();
              }}
              className="mt-6 block w-full rounded-lg px-3 py-3 text-left text-sm text-slate-500 hover:bg-slate-50"
            >
              切換身分
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- inline icons (bottom tabs / menu) --------------------------------- */

function IconList() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
