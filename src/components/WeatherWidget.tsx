import { useState, useEffect } from "react";
import { fetchWeather, type WeatherData } from "@/lib/api";
import { getConfig } from "@/lib/config";
import { Cloud, Droplets, Thermometer } from "lucide-react";

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const cfg = getConfig();
    fetchWeather(cfg.OPENWEATHER_API_KEY, cfg.OPENWEATHER_CITY).then(setWeather);
    const interval = setInterval(() => {
      fetchWeather(cfg.OPENWEATHER_API_KEY, cfg.OPENWEATHER_CITY).then(setWeather);
    }, 600000);
    return () => clearInterval(interval);
  }, []);

  if (!weather) {
    return (
      <div className="glass-panel h-full p-3 flex flex-col items-center justify-center gap-1">
        <Cloud className="w-5 h-5 text-muted-foreground" />
        <span className="text-[10px] font-mono text-muted-foreground">No weather</span>
      </div>
    );
  }

  return (
    <div className="glass-panel h-full p-3 flex flex-col justify-between gap-1">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-mono font-light text-foreground">{weather.temp}°</span>
        <img
          src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
          alt={weather.description}
          className="w-8 h-8 opacity-80 -mr-1"
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground capitalize leading-tight">{weather.description}</span>
      <div className="flex gap-2 text-[10px] font-mono text-muted-foreground/70">
        <span className="flex items-center gap-0.5"><Thermometer className="w-2.5 h-2.5" />{weather.feelsLike}°</span>
        <span className="flex items-center gap-0.5"><Droplets className="w-2.5 h-2.5" />{weather.humidity}%</span>
      </div>
    </div>
  );
}
