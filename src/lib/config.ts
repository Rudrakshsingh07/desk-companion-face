// Helper to get config values safely with defaults
export function getConfig(): ConfigType {
  if (typeof CONFIG !== 'undefined') {
    return CONFIG;
  }
  return {
    LAPTOP_IP: "10.41.182.79",
    LAPTOP_PORT: 8000,
    OPENWEATHER_API_KEY: "",
    OPENWEATHER_CITY: "New York",
    GOOGLE_CALENDAR_API_KEY: "",
    GOOGLE_CALENDAR_ID: "",
    MOTION_SENSITIVITY: 30,
    SESSION_TIMEOUT_SECONDS: 30,
  };
}

export function getApiBase(): string {
  // In dev, use Vite proxy so the frontend can talk to the local FastAPI server
  // without hardcoding LAN IPs/ports or hitting CORS issues.
  if (import.meta.env.DEV) return "/api";

  const c = getConfig();
  return `http://${c.LAPTOP_IP}:${c.LAPTOP_PORT}`;
}
