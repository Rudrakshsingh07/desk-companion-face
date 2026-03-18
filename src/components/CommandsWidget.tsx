import { useEffect, useState, useCallback } from "react";
import { getApiBase } from "@/lib/config";
import {
  Power, Lock, Code2, Camera, Github, Timer, Pencil, X, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

interface Command {
  key: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  confirm?: boolean;
}

const COMMANDS: Command[] = [
  { key: "shutdown", label: "Shutdown", icon: <Power className="w-6 h-6" />, adminOnly: true, confirm: true },
  { key: "lock_screen", label: "Lock PC", icon: <Lock className="w-6 h-6" /> },
  { key: "code_mode", label: "Code", icon: <Code2 className="w-6 h-6" /> },
  { key: "capture_inspiration", label: "Capture", icon: <Camera className="w-6 h-6" /> },
  { key: "project_status", label: "Project Status", icon: <Github className="w-6 h-6" /> },
  { key: "pomodoro", label: "Pomodoro", icon: <Timer className="w-6 h-6" /> },
];

interface CommandsWidgetProps {
  token: string | null;
  role: string | null;
}

export function CommandsWidget({ token, role }: CommandsWidgetProps) {
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [pressing, setPressing] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [repoOverlayOpen, setRepoOverlayOpen] = useState(false);
  const [repoLink, setRepoLink] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroSeconds, setPomodoroSeconds] = useState(25 * 60);

  const isAdmin = role === "admin";

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (pomodoroActive && pomodoroSeconds > 0) {
      timer = setInterval(() => {
        setPomodoroSeconds((prev) => prev - 1);
      }, 1000);
    } else if (pomodoroSeconds === 0) {
      setPomodoroActive(false);
      toast.success("Pomodoro session completed!");
      // Play a subtle sound? No, just notification for now.
    }
    return () => clearInterval(timer);
  }, [pomodoroActive, pomodoroSeconds]);

  const formatPomodoro = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const fetchRepoLink = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${getApiBase()}/settings/project_status_repo`, {
        headers: { "X-Session-Token": token }
      });
      const data = await res.json();
      if (data.value) setRepoLink(data.value);
    } catch (err) {
      console.warn("Failed to fetch repo link", err);
    }
  }, [token]);

  useEffect(() => {
    if (token) void fetchRepoLink();
  }, [token, fetchRepoLink]);

  const handleSaveRepo = async () => {
    if (!token) return;
    setSaveLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/settings/project_status_repo?value=${encodeURIComponent(repoLink)}`, {
        method: "POST",
        headers: { "X-Session-Token": token }
      });
      if (res.ok) {
        toast.success("GitHub repository link saved.");
        setRepoOverlayOpen(false);
      } else {
        toast.error("Failed to save repository link.");
      }
    } catch {
      toast.error("Connection error.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCommand = async (cmd: Command) => {
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    if (cmd.confirm && !confirm(`Are you sure you want to run ${cmd.label}?`)) {
      return;
    }

    setRunningKey(cmd.key);
    try {
      const res = await fetch(`${getApiBase()}/command`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": token
        },
        body: JSON.stringify({ action: cmd.key }),
      });
      const result = await res.json();
      if (result.ok) {
        toast.success(result.message || "Command executed successfully");
      } else {
        toast.error(result.message || "Command failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setRunningKey(null);
    }
  };

  return (
    <div className="macropad-body h-full p-5 flex flex-col gap-4 overflow-hidden">
      {/* Status LCD */}
      <div className="lcd-display px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary lcd-text">
          {pomodoroActive ? `TIMER: ${formatPomodoro(pomodoroSeconds)}` : `Macro Pad — ${token ? "Armed" : "Standby"}`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-primary lcd-text tabular-nums">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="text-[10px] font-mono text-primary lcd-text">
            {role ? role.toUpperCase() : ""}
          </span>
        </div>
      </div>

      {/* Button Grid — 3×2 */}
      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-4 min-h-0">
        {COMMANDS.map((cmd) => {
          const disabled = cmd.adminOnly ? !isAdmin : false;
          const isRunning = runningKey === cmd.key;
          const isShutdown = cmd.key === "shutdown";
          
          return (
            <button
              key={cmd.key}
              className={`macropad-key group relative flex flex-col items-center justify-center gap-2.5 rounded-xl transition-all duration-100 select-none
                ${isShutdown ? "macropad-key-shutdown" : "macropad-key-silver"}
                ${pressing === cmd.key ? "macropad-key-pressed" : ""}
              `}
              onPointerDown={() => !disabled && setPressing(cmd.key)}
              onPointerUp={() => setPressing(null)}
              onPointerLeave={() => setPressing(null)}
              onClick={() => {
                if (disabled) return;
                if (cmd.key === "pomodoro") {
                  setPomodoroActive(!pomodoroActive);
                  if (!pomodoroActive && pomodoroSeconds === 0) {
                    setPomodoroSeconds(25 * 60); // Reset if finished
                  }
                } else {
                  handleCommand(cmd);
                }
              }}
              disabled={disabled || isRunning}
            >
              {cmd.key === "project_status" && (
                <button
                  type="button"
                  className="absolute bottom-2 right-2 h-7 w-7 rounded-full flex items-center justify-center border border-white/10 bg-black/20 hover:bg-black/30 transition z-20"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRepoOverlayOpen(true);
                  }}
                  aria-label="Edit GitHub repo link"
                  title="Set GitHub repo link"
                >
                  <Pencil className="w-3.5 h-3.5 text-foreground" />
                </button>
              )}
              
              <div className={`${isShutdown ? "text-white" : "text-foreground"} group-hover:scale-110 transition-transform drop-shadow-sm`}>
                {isRunning ? <Loader2 className="w-6 h-6 animate-spin" /> : cmd.icon}
              </div>
              <span className={`text-[10px] font-mono font-bold tracking-wider uppercase ${isShutdown ? "text-white" : "text-foreground"}`}>
                {cmd.key === "pomodoro" && pomodoroActive ? formatPomodoro(pomodoroSeconds) : cmd.label}
              </span>
            </button>
          );
        })}
      </div>

      {repoOverlayOpen && (
        <div className="overlay-backdrop" onClick={() => setRepoOverlayOpen(false)}>
          <div
            className="overlay-panel w-[min(520px,92vw)] p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="macropad-screw" />
                <div className="lcd-display px-3 py-1.5 flex items-center gap-2 text-sm font-mono text-primary">
                  <Github className="w-4 h-4" />
                  <span className="lcd-text">Project Repo Link</span>
                </div>
              </div>
              <button className="metal-close-btn" onClick={() => setRepoOverlayOpen(false)} aria-label="Close">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="lcd-display p-3 flex flex-col gap-2 relative z-10">
              <span className="text-[10px] font-mono text-primary">
                Paste a GitHub repository URL (e.g. https://github.com/org/repo)
              </span>
              <Input
                value={repoLink}
                onChange={(e) => setRepoLink(e.target.value)}
                placeholder="https://github.com/..."
                className="font-mono bg-transparent border-0 text-primary placeholder:text-primary/30 focus-visible:ring-0 focus-visible:ring-offset-0"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSaveRepo()}
              />
            </div>

            <div className="flex justify-end gap-2 relative z-10">
              <Button
                type="button"
                variant="secondary"
                className="macropad-key-small px-4"
                onClick={() => setRepoOverlayOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="macropad-key-small px-6"
                onClick={handleSaveRepo}
                disabled={saveLoading}
              >
                {saveLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
