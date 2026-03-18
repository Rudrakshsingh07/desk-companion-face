import { useState } from "react";
import { type SessionAnalytics } from "@/hooks/useAppState";
import { Activity, Clock, Eye, Hash, X, BarChart3, TrendingUp } from "lucide-react";
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
  background: "hsl(170 25% 5%)",
  border: "1px solid hsl(160 60% 30% / 0.4)",
  borderRadius: 6,
  fontSize: 10,
  fontFamily: "monospace",
  color: "hsl(160 70% 55%)",
  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
};

export function AnalyticsWidget({ analytics, sessionStartRef }: AnalyticsWidgetProps) {
  const [open, setOpen] = useState(false);
  const currentSessionMs = sessionStartRef.current ? Date.now() - sessionStartRef.current : 0;
  const totalMs = analytics.totalDeskTimeMs + currentSessionMs;

  const sessionData = useMemo(() => generateSessionData(analytics.sessionCount), [analytics.sessionCount]);
  const weeklyData = useMemo(() => generateWeeklyData(), []);

  return (
    <>
      {/* ── Compact LCD Summary (Dashboard view) ── */}
      <button
        className="lcd-button h-full w-full p-4 flex flex-col gap-3 text-left"
        onClick={() => setOpen(true)}
      >
        {/* Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary lcd-text">
              Analytics
            </span>
          </div>
          <BarChart3 className="w-3 h-3 text-primary/80" />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 relative z-10">
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] font-mono text-primary/70 flex items-center gap-0.5">
              <Clock className="w-2 h-2" /> Desk
            </span>
            <span className="text-sm font-mono font-semibold text-primary lcd-text">{formatDuration(totalMs)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] font-mono text-primary/70 flex items-center gap-0.5">
              <Hash className="w-2 h-2" /> Sess
            </span>
            <span className="text-sm font-mono font-semibold text-primary lcd-text">{analytics.sessionCount}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] font-mono text-primary/70 flex items-center gap-0.5">
              <Eye className="w-2 h-2" /> Seen
            </span>
            <span className="text-sm font-mono font-semibold text-primary lcd-text">
              {analytics.lastSeenTime
                ? analytics.lastSeenTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "—"}
            </span>
          </div>
        </div>

        {/* Mini chart hint */}
        <div className="flex-1 min-h-0 relative z-10">
          <div className="h-full flex items-end gap-[3px] px-1">
            {weeklyData.map((d, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-primary/30"
                style={{ height: `${Math.max(8, (d.minutes / 140) * 100)}%` }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-1 relative z-10">
          <TrendingUp className="w-2.5 h-2.5 text-primary/60" />
          <span className="text-[8px] font-mono text-primary/60 tracking-wider">TAP FOR DETAILS</span>
        </div>
      </button>

      {/* ── Full Analytics Overlay ── */}
      {open && (
        <div className="overlay-backdrop" onClick={() => setOpen(false)}>
          <div className="overlay-panel w-[520px] max-h-[80vh] p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            {/* Overlay Header */}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="macropad-screw" />
                <div className="lcd-display px-3 py-1.5 flex items-center gap-2 text-sm font-mono text-primary">
                  <Activity className="w-4 h-4" />
                  <span className="lcd-text">Analytics Dashboard</span>
                </div>
              </div>
              <button className="metal-close-btn" onClick={() => setOpen(false)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Stat LCDs */}
            <div className="grid grid-cols-3 gap-3 relative z-10">
              <div className="lcd-display p-3 flex flex-col gap-1">
                <span className="text-[9px] font-mono text-primary/80 flex items-center gap-1 relative z-10">
                  <Clock className="w-2.5 h-2.5" /> Desk Time
                </span>
                <span className="text-lg font-mono font-semibold text-primary lcd-text relative z-10">{formatDuration(totalMs)}</span>
              </div>
              <div className="lcd-display p-3 flex flex-col gap-1">
                <span className="text-[9px] font-mono text-primary/80 flex items-center gap-1 relative z-10">
                  <Hash className="w-2.5 h-2.5" /> Sessions
                </span>
                <span className="text-lg font-mono font-semibold text-primary lcd-text relative z-10">{analytics.sessionCount}</span>
              </div>
              <div className="lcd-display p-3 flex flex-col gap-1">
                <span className="text-[9px] font-mono text-primary/80 flex items-center gap-1 relative z-10">
                  <Eye className="w-2.5 h-2.5" /> Last Seen
                </span>
                <span className="text-lg font-mono font-semibold text-primary lcd-text relative z-10">
                  {analytics.lastSeenTime
                    ? analytics.lastSeenTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>
              </div>
            </div>

            {/* Activity Chart */}
            <div className="lcd-display p-4 flex flex-col gap-2 relative z-10">
              <span className="text-[9px] font-mono text-primary/50 uppercase tracking-wider relative z-10">Activity</span>
              <div className="h-28 w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sessionData}>
                    <defs>
                      <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(160, 70%, 48%)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(160, 70%, 48%)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 9, fill: "hsl(160, 60%, 40%)", fontFamily: "monospace" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="activity"
                      stroke="hsl(160, 70%, 48%)"
                      strokeWidth={1.5}
                      fill="url(#activityGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Weekly Bar Chart */}
            <div className="lcd-display p-4 flex flex-col gap-2 relative z-10">
              <span className="text-[9px] font-mono text-primary/50 uppercase tracking-wider relative z-10">Weekly (min)</span>
              <div className="h-24 w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 9, fill: "hsl(160, 60%, 40%)", fontFamily: "monospace" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="minutes" fill="hsl(160, 70%, 48%)" radius={[3, 3, 0, 0]} opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center gap-2 relative z-10">
              <div className="macropad-screw" />
              <span className="text-[8px] font-mono text-foreground/20 tracking-wider uppercase">Analytics Module</span>
              <div className="macropad-screw" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
