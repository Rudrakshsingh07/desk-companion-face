import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getApiBase } from "@/lib/config";
import {
  Play, Pause, SkipForward, SkipBack,
  Volume2, VolumeX, Lock, Terminal,
  MonitorSpeaker, Maximize, Minimize, Sun, Moon, Camera
} from "lucide-react";

interface Command {
  action: string;
  label: string;
  icon: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
}

const MEDIA_COMMANDS: Command[] = [
  { action: "media_prev", label: "Previous", icon: <SkipBack className="w-4 h-4" /> },
  { action: "media_pause", label: "Pause", icon: <Pause className="w-4 h-4" /> },
  { action: "media_play", label: "Play", icon: <Play className="w-4 h-4" /> },
  { action: "media_next", label: "Next", icon: <SkipForward className="w-4 h-4" /> },
];

const VOLUME_COMMANDS: Command[] = [
  { action: "volume_up", label: "Volume Up", icon: <Volume2 className="w-4 h-4" /> },
  { action: "volume_down", label: "Volume Down", icon: <VolumeX className="w-4 h-4" /> },
];

const SYSTEM_COMMANDS: Command[] = [
  { action: "lock", label: "Lock PC", icon: <Lock className="w-4 h-4" />, variant: "destructive" },
  { action: "screenshot", label: "Screenshot", icon: <Camera className="w-4 h-4" /> },
  { action: "fullscreen", label: "Fullscreen", icon: <Maximize className="w-4 h-4" /> },
  { action: "minimize_all", label: "Show Desktop", icon: <Minimize className="w-4 h-4" /> },
  { action: "brightness_up", label: "Bright +", icon: <Sun className="w-4 h-4" /> },
  { action: "brightness_down", label: "Bright −", icon: <Moon className="w-4 h-4" /> },
  { action: "monitor_off", label: "Monitor Off", icon: <MonitorSpeaker className="w-4 h-4" />, variant: "destructive" },
];

async function runCommand(action: string) {
  try {
    const res = await fetch(`${getApiBase()}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    return await res.json();
  } catch {
    return { status: "error" };
  }
}

export function CommandsWidget() {
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleCommand = async (action: string) => {
    setLastResult(null);
    const result = await runCommand(action);
    setLastResult(result.status === "ok" ? `✓ ${action}` : `✗ ${action}`);
    setTimeout(() => setLastResult(null), 2000);
  };

  const renderButton = (cmd: Command) => (
    <Button
      key={cmd.action}
      variant={cmd.variant ?? "secondary"}
      className="h-12 flex items-center gap-2 font-mono text-xs justify-start px-3"
      onClick={() => handleCommand(cmd.action)}
    >
      {cmd.icon}
      <span>{cmd.label}</span>
    </Button>
  );

  return (
    <div className="glass-panel p-4 flex flex-col gap-3 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <Terminal className="w-3.5 h-3.5" />
          <span>Remote Controls</span>
        </div>
        {lastResult && (
          <span className="text-[10px] font-mono text-primary animate-fade-in">{lastResult}</span>
        )}
      </div>

      {/* Controls grid */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
        {/* Media */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Media</span>
          <div className="grid grid-cols-4 gap-1.5">
            {MEDIA_COMMANDS.map(renderButton)}
          </div>
        </div>

        {/* Volume */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Volume</span>
          <div className="grid grid-cols-2 gap-1.5">
            {VOLUME_COMMANDS.map(renderButton)}
          </div>
        </div>

        {/* System */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">System</span>
          <div className="grid grid-cols-3 gap-1.5">
            {SYSTEM_COMMANDS.map(renderButton)}
          </div>
        </div>
      </div>
    </div>
  );
}
