import { useState } from "react";
import { Input } from "@/components/ui/input";
import { KeyRound, LogIn } from "lucide-react";
import { login } from "@/lib/api";
import type { SessionRole } from "@/hooks/useAppState";

interface LoginScreenProps {
  onLogin: (userId: string, token: string, role: SessionRole) => void;
  onCancel: () => void;
}

export function LoginScreen({ onLogin, onCancel }: LoginScreenProps) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const res = await login(userId.trim(), password);
    if (res.status === "ok" && res.username && res.token && res.role) {
      onLogin(res.username, res.token, res.role);
      return;
    }
    setError(res.error || "Invalid credentials");
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center metal-chassis animate-fade-in">
      <form
        onSubmit={handleSubmit}
        className="macropad-body p-8 w-full max-w-sm flex flex-col gap-6"
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-3 relative z-10">
          <div className="lcd-display p-3 rounded-full">
            <KeyRound className="w-8 h-8 text-primary relative z-10" />
          </div>
          <h2 className="text-sm font-mono text-foreground/60 tracking-[0.3em] uppercase">Manual Login</h2>
        </div>

        {/* Input fields styled as recessed LCD areas */}
        <div className="flex flex-col gap-3 relative z-10">
          <div className="lcd-display p-0.5">
            <Input
              placeholder="User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="font-mono bg-transparent border-0 text-primary placeholder:text-primary/30 focus-visible:ring-0 focus-visible:ring-offset-0 relative z-10"
              autoFocus
            />
          </div>
          <div className="lcd-display p-0.5">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono bg-transparent border-0 text-primary placeholder:text-primary/30 focus-visible:ring-0 focus-visible:ring-offset-0 relative z-10"
            />
          </div>
        </div>

        {error && (
          <div className="lcd-display px-3 py-2 relative z-10">
            <span className="text-xs font-mono text-red-400 lcd-text text-center block relative z-10">{error}</span>
          </div>
        )}

        {/* Action buttons as metal keycaps */}
        <div className="flex gap-3 relative z-10">
          <button type="button" className="macropad-key macropad-key-silver flex-1 py-2.5 flex items-center justify-center gap-2 font-mono text-xs" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="macropad-key macropad-key-silver flex-1 py-2.5 flex items-center justify-center gap-2 font-mono text-xs">
            <LogIn className="w-4 h-4" /> Login
          </button>
        </div>
      </form>
    </div>
  );
}
