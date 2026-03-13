import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, LogIn } from "lucide-react";
import { login } from "@/lib/api";

interface LoginScreenProps {
  onLogin: (userId: string) => void;
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
    if (res.status === "ok" && res.username) {
      onLogin(res.username);
      return;
    }
    setError(res.error || "Invalid credentials");
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background animate-fade-in">
      <form
        onSubmit={handleSubmit}
        className="glass-panel p-8 w-full max-w-sm flex flex-col gap-6"
      >
        <div className="flex flex-col items-center gap-3">
          <KeyRound className="w-10 h-10 text-primary" />
          <h2 className="text-lg font-mono text-foreground tracking-wider">MANUAL LOGIN</h2>
        </div>

        <div className="flex flex-col gap-3">
          <Input
            placeholder="User ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="font-mono bg-secondary border-border"
            autoFocus
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="font-mono bg-secondary border-border"
          />
        </div>

        {error && (
          <span className="text-sm font-mono text-destructive text-center">{error}</span>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1 font-mono" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1 font-mono gap-2">
            <LogIn className="w-4 h-4" /> Login
          </Button>
        </div>
      </form>
    </div>
  );
}
