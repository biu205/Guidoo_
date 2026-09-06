"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { getSession, clearSession } from "@/lib/session";

// The parent app is a single screen (the thread with the teacher), so the
// Figma only shows a mobile layout. Centre it on wider viewports.
export default function ParentLayout({ children }: LayoutProps<"/parent">) {
  const router = useRouter();
  const [name, setName] = useState("家長");
  useEffect(() => {
    const s = getSession();
    if (!s || s.user.role !== "parent") {
      router.replace("/login");
      return;
    }
    setName(s.user.name);
  }, [router]);

  function switchIdentity() {
    clearSession();
    router.push("/login");
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-card shadow-sm">
      <header className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3">
        <Wordmark className="text-xl" />
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{name}</span>
          <button
            onClick={switchIdentity}
            className="rounded-full border border-hairline px-3 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50"
          >
            切換身分
          </button>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
