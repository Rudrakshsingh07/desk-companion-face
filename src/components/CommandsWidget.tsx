import { useState } from "react";
import { getApiBase } from "@/lib/config";
import {
  Power, Lock, Code2, RefreshCw, ArrowUpCircle, Timer
} from "lucide-react";

interface Command {
  action: string;
  label: string;
  icon: React.ReactNode;
  isShutdown?: boolean;
}

const COMMANDS: Command[] = [
  { action: "shutdown", label: "Shut Down", icon: <Power className="w-5 h-5" />, isShutdown: true },
  { action: "lock", label: "Lock System", icon: <Lock className="w-5 h-5" /> },
  { action: "coding_workspace", label: "Coding Workspace", icon: <Code2 className="w-5 h-5" /> },
  { action: "system_update", label: "System Update", icon: <RefreshCw className="w-5 h-5" /> },
  { action: "system_upgrade", label: "System Upgrade", icon: <ArrowUpCircle className="w-5 h-5" /> },
  { action: "pomodoro_30", label: "Pomodoro (30 Min)", icon: <Timer className="w-5 h-5" /> },
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
  const [pressing, setPressing] = useState<string | null>(null);

  const handleCommand = async (action: string) => {
    setLastResult(null);
    const result = await runCommand(action);
    setLastResult(result.status === "ok" ? `✓ ${action}` : `✗ ${action}`);
    setTimeout(() => setLastResult(null), 2000);
  };

  return (
    <div className="macropad-body h-full p-6 flex flex-col gap-4 overflow-hidden">
      {/* Status LCD */}
      <div className="lcd-display px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary">
          Macro Pad — Ready
        </span>
        {lastResult && (
          <span className="text-[10px] font-mono text-primary animate-fade-in">{lastResult}</span>
        )}
      </div>

      {/* Button Grid */}
      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-4 min-h-0">
        {COMMANDS.map((cmd) => (
          <button
            key={cmd.action}
            className={`macropad-key group relative flex flex-col items-center justify-center gap-2 rounded-xl transition-all duration-100 select-none
              ${cmd.isShutdown ? "macropad-key-shutdown" : "macropad-key-silver"}
              ${pressing === cmd.action ? "macropad-key-pressed" : ""}
            `}
            onPointerDown={() => setPressing(cmd.action)}
            onPointerUp={() => setPressing(null)}
            onPointerLeave={() => setPressing(null)}
            onClick={() => handleCommand(cmd.action)}
          >
            <div className={`${cmd.isShutdown ? "text-orange-950" : "text-foreground/70"} group-hover:scale-110 transition-transform`}>
              {cmd.icon}
            </div>
            <span className={`text-[11px] font-mono font-medium tracking-wide ${cmd.isShutdown ? "text-orange-950" : "text-foreground/60"}`}>
              {cmd.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
