import { ClockDisplay } from "@/components/ClockDisplay";
import { WeatherWidget } from "@/components/WeatherWidget";
import { CalendarWidget } from "@/components/CalendarWidget";
import { AnalyticsWidget } from "@/components/AnalyticsWidget";
import { CommandsWidget } from "@/components/CommandsWidget";
import { type SessionAnalytics } from "@/hooks/useAppState";
import { User, LogOut, Lock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type MutableRefObject } from "react";

interface DashboardScreenProps {
  userId: string;
  analytics: SessionAnalytics;
  sessionStartRef: MutableRefObject<number | null>;
  onLogout: () => void;
  onLock: () => void;
  onAdmin: () => void;
  isAdmin: boolean;
}

export function DashboardScreen({ userId, analytics, sessionStartRef, onLogout, onLock, onAdmin, isAdmin }: DashboardScreenProps) {
  return (
    <div className="absolute inset-0 bg-background p-3 animate-fade-in">
      <div className="h-full flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="text-xs font-mono text-primary tracking-wider uppercase">Authenticated</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
              <User className="w-3 h-3" /> {userId}
            </span>
            {isAdmin && (
              <Button variant="ghost" size="sm" className="h-7 px-2 font-mono text-xs text-muted-foreground gap-1" onClick={onAdmin}>
                <Settings className="w-3 h-3" /> Admin
              </Button>
            )}
            <Button variant="secondary" size="sm" className="h-7 px-2 font-mono text-xs gap-1" onClick={onLock}>
              <Lock className="w-3 h-3" /> Lock
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 font-mono text-xs text-muted-foreground gap-1" onClick={onLogout}>
              <LogOut className="w-3 h-3" /> Logout
            </Button>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="flex-1 grid grid-cols-12 grid-rows-6 gap-2.5 min-h-0">
          {/* Commands — Primary area, left 8 cols, all rows */}
          <div className="col-span-8 row-span-6">
            <CommandsWidget />
          </div>

          {/* Clock — top right compact */}
          <div className="col-span-4 row-span-2">
            <ClockDisplay size="small" />
          </div>

          {/* Weather + Calendar row */}
          <div className="col-span-2 row-span-2">
            <WeatherWidget />
          </div>
          <div className="col-span-2 row-span-2">
            <CalendarWidget />
          </div>

          {/* Analytics + version */}
          <div className="col-span-3 row-span-2">
            <AnalyticsWidget analytics={analytics} sessionStartRef={sessionStartRef} />
          </div>
          <div className="col-span-1 row-span-2">
            <div className="glass-panel h-full flex flex-col items-center justify-center gap-1 p-2">
              <span className="text-[10px] font-mono text-muted-foreground leading-tight text-center">DESK<br/>COMPANION</span>
              <span className="text-[9px] font-mono text-muted-foreground/40">v1.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
