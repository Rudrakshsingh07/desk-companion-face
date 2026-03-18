import { ClockDisplay } from "@/components/ClockDisplay";
import { AnalyticsWidget } from "@/components/AnalyticsWidget";
import { CommandsWidget } from "@/components/CommandsWidget";
import { NotificationsWidget } from "@/components/NotificationsWidget";
import { type SessionAnalytics } from "@/hooks/useAppState";
import { User, Lock, Settings } from "lucide-react";
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
  token: string | null;
  role: string | null;
}

export function DashboardScreen({ userId, analytics, sessionStartRef, onLogout, onLock, onAdmin, isAdmin, token, role }: DashboardScreenProps) {
  return (
    <div className="absolute inset-0 metal-chassis p-4 animate-fade-in">
      <div className="h-full flex flex-col gap-3">

        {/* ── Header Metal Strip ── */}
        <div className="metal-header flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="macropad-screw" />
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_hsl(160_70%_50%/0.7)]" />
            <span className="text-[10px] font-mono text-foreground tracking-[0.2em] uppercase">
              Authenticated
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-foreground flex items-center gap-1.5">
              <User className="w-3 h-3" /> {userId}
            </span>
            {isAdmin && (
              <Button variant="ghost" size="sm" className="h-7 px-2 font-mono text-[10px] text-foreground gap-1 hover:text-foreground/80" onClick={onAdmin}>
                <Settings className="w-3 h-3" /> Admin
              </Button>
            )}
            <button className="macropad-key-small" onClick={onLock}>
              <Lock className="w-3 h-3" /> Lock
            </button>
            <div className="macropad-screw" />
          </div>
        </div>

        {/* ── Main Content Area ── */}
        <div className="flex-1 flex gap-3 min-h-0">

          {/* Left — Macropad Buttons Panel */}
          <div className="flex-1 min-h-0">
            <CommandsWidget 
              token={token} 
              role={role} 
            />
          </div>

          {/* Right — LCD Info Strip */}
          <div className="w-80 flex flex-col gap-3 min-h-0">
            {/* Analytics LCD (clickable) */}
            <div className="flex-1 min-h-0">
              <AnalyticsWidget analytics={analytics} sessionStartRef={sessionStartRef} />
            </div>

            {/* Notifications */}
            <div className="flex-1 min-h-0">
              <NotificationsWidget />
            </div>
          </div>
        </div>

        {/* ── Bottom Metal Strip — Brand Badge ── */}
        <div className="metal-header flex items-center justify-between px-4 py-1.5">
          <div className="macropad-screw" />
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-foreground/25 tracking-[0.3em] uppercase">
              Desk Companion
            </span>
            <span className="text-[8px] font-mono text-foreground/15">v1.0</span>
          </div>
          <div className="macropad-screw" />
        </div>
      </div>
    </div>
  );
}
