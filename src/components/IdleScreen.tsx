import { ClockDisplay } from "@/components/ClockDisplay";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";

interface IdleScreenProps {
  onManualLogin: () => void;
}

export function IdleScreen({ onManualLogin }: IdleScreenProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background animate-fade-in">
      <ClockDisplay size="large" />
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground/40">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse-glow" />
          <span>Watching for presence</span>
        </div>
        <Button variant="ghost" size="sm" className="font-mono text-xs text-muted-foreground/50 gap-2" onClick={onManualLogin}>
          <KeyRound className="w-3 h-3" /> Manual Login
        </Button>
      </div>
    </div>
  );
}
