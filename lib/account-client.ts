import type { AppData } from "./types";

export interface AccountSession {
  token: string;
  name: string;
  data: AppData;
}

async function send<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Could not reach your account.");
  return payload;
}

export function registerAccount(input: { name: string; password: string; data: AppData }) {
  return send<AccountSession>({ action: "register", ...input });
}

export function loginAccount(input: { name: string; password: string }) {
  return send<AccountSession>({ action: "login", ...input });
}

export function sessionAccount(token: string) {
  return send<AccountSession>({ action: "session", token });
}

export function saveAccount(token: string, data: AppData) {
  return send<{ ok: boolean }>({ action: "save", token, data });
}

export function logoutAccount(token: string) {
  return send<{ ok: boolean }>({ action: "logout", token });
}
