import { ClockDisplay } from "@/components/ClockDisplay";
import { Button } from "@/components/ui/button";
import { ShieldAlert, RefreshCw, LogIn } from "lucide-react";

interface LockedScreenProps {
  onRetry: () => void;
  onManualLogin: () => void;
}

export function LockedScreen({ onRetry, onManualLogin }: LockedScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background animate-fade-in">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <ShieldAlert className="w-16 h-16 text-warning" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-warning/30 animate-pulse-glow" />
        </div>
        <span className="text-lg font-mono text-warning tracking-wider">UNRECOGNIZED</span>
        <span className="text-sm font-mono text-muted-foreground">Access denied • Attempt logged</span>

        <div className="flex gap-3 mt-4">
          <Button variant="secondary" className="font-mono gap-2" onClick={onManualLogin}>
            <LogIn className="w-4 h-4" /> Manual Login
          </Button>
          <Button className="font-mono gap-2" onClick={onRetry}>
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      </div>
      <div className="absolute bottom-12">
        <ClockDisplay size="small" />
      </div>
    </div>
  );
}
