import { type SessionAnalytics } from "@/hooks/useAppState";
import { Activity, Clock, Eye, Hash } from "lucide-react";
import { type MutableRefObject, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface AnalyticsWidgetProps {
  analytics: SessionAnalytics;
  sessionStartRef: MutableRefObject<number | null>;
}

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function generateSessionData(sessionCount: number) {
  const hours = ["6am", "8am", "10am", "12pm", "2pm", "4pm"];
  return hours.map((hour, i) => ({
    hour,
    activity: Math.max(0, Math.round(Math.sin((i - 2) * 0.5) * 40 + 30 + Math.random() * 20)),
  }));
}

function generateWeeklyData() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date().getDay();
  return days.map((day, i) => ({
    day,
    minutes: i <= (today === 0 ? 6 : today - 1)
      ? Math.round(Math.random() * 120 + 10)
      : 0,
  }));
}

const tooltipStyle = {
  background: "hsl(200 20% 8%)",
  border: "1px solid hsl(160 60% 30% / 0.3)",
  borderRadius: 6,
  fontSize: 10,
  fontFamily: "monospace",
  color: "hsl(160 60% 50%)",
  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
};

export function AnalyticsWidget({ analytics, sessionStartRef }: AnalyticsWidgetProps) {
  const currentSessionMs = sessionStartRef.current ? Date.now() - sessionStartRef.current : 0;
  const totalMs = analytics.totalDeskTimeMs + currentSessionMs;

  const sessionData = useMemo(() => generateSessionData(analytics.sessionCount), [analytics.sessionCount]);
  const weeklyData = useMemo(() => generateWeeklyData(), []);

  return (
    <div className="macropad-body h-full p-4 flex flex-col gap-3 overflow-y-auto">
      {/* Header LCD */}
      <div className="lcd-display px-3 py-1.5 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
        <Activity className="w-3 h-3" /> Analytics
      </div>

      {/* Stat LCDs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="lcd-display p-2.5 flex flex-col gap-1">
          <span className="text-[9px] font-mono text-primary/50 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> Desk
          </span>
          <span className="text-base font-mono font-semibold text-primary lcd-text">{formatDuration(totalMs)}</span>
        </div>
        <div className="lcd-display p-2.5 flex flex-col gap-1">
          <span className="text-[9px] font-mono text-primary/50 flex items-center gap-1">
            <Hash className="w-2.5 h-2.5" /> Sess
          </span>
          <span className="text-base font-mono font-semibold text-primary lcd-text">{analytics.sessionCount}</span>
        </div>
        <div className="lcd-display p-2.5 flex flex-col gap-1">
          <span className="text-[9px] font-mono text-primary/50 flex items-center gap-1">
            <Eye className="w-2.5 h-2.5" /> Seen
          </span>
          <span className="text-base font-mono font-semibold text-primary lcd-text">
            {analytics.lastSeenTime
              ? analytics.lastSeenTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "—"}
          </span>
        </div>
      </div>

      {/* Activity Chart LCD */}
      <div className="lcd-display p-3 flex flex-col gap-1.5">
        <span className="text-[9px] font-mono text-primary/50 uppercase tracking-wider">Activity</span>
        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sessionData}>
              <defs>
                <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 8, fill: "hsl(160, 60%, 35%)", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="activity"
                stroke="hsl(160, 60%, 45%)"
                strokeWidth={1.5}
                fill="url(#activityGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Bar Chart LCD */}
      <div className="lcd-display p-3 flex flex-col gap-1.5">
        <span className="text-[9px] font-mono text-primary/50 uppercase tracking-wider">Weekly (min)</span>
        <div className="h-20 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 8, fill: "hsl(160, 60%, 35%)", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="minutes" fill="hsl(160, 60%, 45%)" radius={[3, 3, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
