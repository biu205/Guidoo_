"use client";

// Client-side session store. The backend hands back a bearer token plus a
// `user` object on login; we keep both in localStorage and expose helpers.

import type { Role } from "./types";

export type LoginStudent = { id: string; name: string; classId: string };
export type LoginClass = { id: string; name: string };

export type SessionUser = {
  id: string;
  name: string;
  role: Role;
  students?: LoginStudent[]; // parent
  classes?: LoginClass[]; // teacher
};

export type Session = { token: string; user: SessionUser };

const KEY = "guidoo.session";

export function saveSession(s: Session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode / storage disabled — nothing we can do */
  }
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
