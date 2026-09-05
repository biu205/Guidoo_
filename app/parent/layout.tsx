"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { getSession } from "@/lib/session";

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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <Wordmark className="text-xl" />
        <span className="text-sm text-slate-600">{name}</span>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
