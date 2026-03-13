import { getApiBase } from "./config";

interface RecognizeResponse {
  authenticated: boolean;
  user_id: string;
}

export async function recognizeFace(imageBase64: string): Promise<RecognizeResponse | null> {
  try {
    const res = await fetch(`${getApiBase()}/recognize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageBase64 }),
    });
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
): Promise<{ status: string; error?: string; username?: string; role?: "admin" | "user" }> {
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

export interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  humidity: number;
  feelsLike: number;
}

export async function fetchWeather(apiKey: string, city: string): Promise<WeatherData | null> {
  if (!apiKey || !city) return null;
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      temp: Math.round(data.main.temp),
      description: data.weather[0]?.description ?? "",
      icon: data.weather[0]?.icon ?? "01d",
      humidity: data.main.humidity,
      feelsLike: Math.round(data.main.feels_like),
    };
  } catch {
    return null;
  }
}

export interface CalendarEvent {
  summary: string;
  start: string;
  end: string;
}

export async function fetchCalendarEvents(
  apiKey: string,
  calendarId: string
): Promise<CalendarEvent[]> {
  if (!apiKey || !calendarId) return [];
  try {
    const now = new Date().toISOString();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${now}&timeMax=${endOfDay.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=5`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map((item: any) => ({
      summary: item.summary ?? "No title",
      start: item.start?.dateTime ?? item.start?.date ?? "",
      end: item.end?.dateTime ?? item.end?.date ?? "",
    }));
  } catch {
    return [];
  }
}
