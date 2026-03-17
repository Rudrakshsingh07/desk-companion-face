import { ClockDisplay } from "@/components/ClockDisplay";
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
        {/* Header — styled as brushed metal bar */}
        <div className="macropad-body flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_hsl(160_60%_45%/0.6)]" />
            <span className="text-xs font-mono text-foreground/60 tracking-wider uppercase">Authenticated</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-foreground/40 flex items-center gap-1.5">
              <User className="w-3 h-3" /> {userId}
            </span>
            {isAdmin && (
              <Button variant="ghost" size="sm" className="h-7 px-2 font-mono text-xs text-foreground/40 gap-1 hover:text-foreground/70" onClick={onAdmin}>
                <Settings className="w-3 h-3" /> Admin
              </Button>
            )}
            <button className="macropad-key-silver macropad-key-small" onClick={onLock}>
              <Lock className="w-3 h-3" /> Lock
            </button>
            <button className="macropad-key-silver macropad-key-small" onClick={onLogout}>
              <LogOut className="w-3 h-3" /> Logout
            </button>
          </div>
        </div>

        {/* Main Layout */}
        <div className="flex-1 flex gap-3 min-h-0">
          {/* Left: Commands + utilities */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex-1 min-h-0">
              <CommandsWidget />
            </div>
            <div className="flex gap-3 h-24">
              <div className="flex-1">
                <ClockDisplay size="small" />
              </div>
              <div className="w-40">
                <CalendarWidget />
              </div>
              <div className="macropad-body flex flex-col items-center justify-center gap-1 p-2 w-20">
                <span className="text-[10px] font-mono text-foreground/30 leading-tight text-center">DESK<br/>COMPANION</span>
                <span className="text-[9px] font-mono text-foreground/15">v1.0</span>
              </div>
            </div>
          </div>

          {/* Right: Analytics */}
          <div className="w-80 min-h-0">
            <AnalyticsWidget analytics={analytics} sessionStartRef={sessionStartRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
