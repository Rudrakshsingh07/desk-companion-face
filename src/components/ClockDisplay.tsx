import { useState, useEffect } from "react";
import { format } from "date-fns";

interface ClockDisplayProps {
  size?: "large" | "small";
}

export function ClockDisplay({ size = "large" }: ClockDisplayProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (size === "small") {
    return (
      <div className="lcd-display h-full p-4 flex flex-col items-center justify-center">
        <span className="text-4xl font-mono font-light text-primary tracking-wider lcd-text">
          {format(now, "HH:mm")}
        </span>
        <span className="text-[10px] font-mono text-primary/60 mt-1 tracking-wide">
          {format(now, "EEEE, MMM d")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <span className="text-9xl font-mono font-extralight text-foreground tracking-widest text-glow-primary">
        {format(now, "HH:mm")}
      </span>
      <span className="text-lg font-mono text-muted-foreground mt-4 tracking-wide">
        {format(now, "EEEE, MMMM d, yyyy")}
      </span>
    </div>
  );
}
