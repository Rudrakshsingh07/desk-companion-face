/// <reference types="vite/client" />

interface ConfigType {
  LAPTOP_IP: string;
  LAPTOP_PORT: number;
  OPENWEATHER_API_KEY: string;
  OPENWEATHER_CITY: string;
  GOOGLE_CALENDAR_API_KEY: string;
  GOOGLE_CALENDAR_ID: string;
  MOTION_SENSITIVITY: number;
  SESSION_TIMEOUT_SECONDS: number;
}

declare const CONFIG: ConfigType;
