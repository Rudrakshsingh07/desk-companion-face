import { type SessionAnalytics } from "@/hooks/useAppState";
import { Activity, Clock, Eye, Hash } from "lucide-react";
import { type MutableRefObject } from "react";

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

export function AnalyticsWidget({ analytics, sessionStartRef }: AnalyticsWidgetProps) {
  const currentSessionMs = sessionStartRef.current ? Date.now() - sessionStartRef.current : 0;
  const totalMs = analytics.totalDeskTimeMs + currentSessionMs;

  return (
    <div className="glass-panel h-full p-3 flex flex-col justify-between gap-2">
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
        <Activity className="w-3 h-3" /> Analytics
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> Desk
          </span>
          <span className="text-sm font-mono text-foreground">{formatDuration(totalMs)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
            <Hash className="w-2.5 h-2.5" /> Sessions
          </span>
          <span className="text-sm font-mono text-foreground">{analytics.sessionCount}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
            <Eye className="w-2.5 h-2.5" /> Last
          </span>
          <span className="text-sm font-mono text-foreground">
            {analytics.lastSeenTime
              ? analytics.lastSeenTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
