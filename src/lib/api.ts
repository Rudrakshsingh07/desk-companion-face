import { getApiBase } from "./config";

interface RecognizeResponse {
  authenticated: boolean;
  user_id: string;
  role?: "admin" | "user";
  token?: string;
}

export async function recognizeFace(
  imageBase64: string,
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<RecognizeResponse | null> {
  try {
    const timeoutMs = opts?.timeoutMs ?? 6000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const signal = opts?.signal ? AbortSignal.any([opts.signal, controller.signal]) : controller.signal;

    const res = await fetch(`${getApiBase()}/recognize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageBase64 }),
      signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function logEvent(
  event: "auth_success" | "auth_fail" | "session_end",
  userId: string
): Promise<void> {
  try {
    await fetch(`${getApiBase()}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, user_id: userId, timestamp: new Date().toISOString() }),
    });
  } catch {
    // silent fail
  }
}

export async function registerFace(username: string, imageBase64: string): Promise<{ status: string; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/register-face`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, image: imageBase64 }),
    });
    return await res.json();
  } catch {
    return { status: "error", error: "Network error" };
  }
}

export interface UserRecord {
  username: string;
  role: "admin" | "user";
  createdAt: string;
}

export async function fetchUsers(): Promise<UserRecord[]> {
  try {
    const res = await fetch(`${getApiBase()}/users`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.users ?? []) as UserRecord[];
  } catch {
    return [];
  }
}

export async function registerUser(
  username: string,
  password: string,
  role: "admin" | "user",
  imageBase64: string
): Promise<{ status: string; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/register-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role, image: imageBase64 }),
    });
    return await res.json();
  } catch {
    return { status: "error", error: "Network error" };
  }
}

export async function deleteUser(username: string): Promise<{ status: string; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/users/${encodeURIComponent(username)}`, {
      method: "DELETE",
    });
    return await res.json();
  } catch {
    return { status: "error", error: "Network error" };
  }
}

export async function login(
  username: string,
  password: string
): Promise<{ status: string; error?: string; username?: string; role?: "admin" | "user"; token?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return await res.json();
  } catch {
    return { status: "error", error: "Network error" };
  }
}

export const runCommand = async (action: string, token: string, meta: Record<string, unknown> = {}) => {
  const res = await fetch(`${getApiBase()}/command`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Token": token,
    },
    body: JSON.stringify({ action, meta }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Command failed (${res.status})`);
  }
  return res.json() as Promise<{ ok: boolean; message: string; action: string }>;
};

export const saveSetting = async (key: string, value: string, token: string) => {
  const res = await fetch(`${getApiBase()}/settings/${encodeURIComponent(key)}?value=${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { "X-Session-Token": token },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Save failed (${res.status})`);
  }
  return res.json() as Promise<{ ok: boolean }>;
};

export const getSetting = async (key: string, token: string) => {
  const res = await fetch(`${getApiBase()}/settings/${encodeURIComponent(key)}`, {
    headers: { "X-Session-Token": token },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Fetch failed (${res.status})`);
  }
  return res.json() as Promise<{ key: string; value: string | null }>;
};

export interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  humidity: number;
  feelsLike: number;
}

export interface CalendarEvent {
  summary: string;
  start: string;
  end: string;
}

// Calendar + weather removed from project.
