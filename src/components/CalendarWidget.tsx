import { useState, useEffect } from "react";
import { fetchCalendarEvents, type CalendarEvent } from "@/lib/api";
import { getConfig } from "@/lib/config";
import { Calendar, Clock, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";

export function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const cfg = getConfig();
    fetchCalendarEvents(cfg.GOOGLE_CALENDAR_API_KEY, cfg.GOOGLE_CALENDAR_ID).then(setEvents);
    const interval = setInterval(() => {
      fetchCalendarEvents(cfg.GOOGLE_CALENDAR_API_KEY, cfg.GOOGLE_CALENDAR_ID).then(setEvents);
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Button
        variant="secondary"
        className="glass-panel h-full w-full flex flex-col items-center justify-center gap-1.5 border border-border hover:border-primary/30 transition-colors"
        onClick={() => setOpen(true)}
      >
        <Calendar className="w-5 h-5 text-muted-foreground" />
        <span className="text-[10px] font-mono text-muted-foreground">
          {events.length > 0 ? `${events.length} event${events.length > 1 ? "s" : ""}` : "Calendar"}
        </span>
      </Button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)}>
          <div className="glass-panel w-80 max-h-[70vh] p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Upcoming Events</span>
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            {events.length === 0 ? (
              <div className="flex flex-col items-center py-6 gap-1">
                <span className="text-sm font-mono text-muted-foreground/70">No events</span>
                <span className="text-xs text-muted-foreground/40">Calendar clear</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1 overflow-y-auto">
                {events.map((event, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-2 border-b border-border/30 last:border-0">
                    <div className="w-0.5 h-full min-h-[1.5rem] rounded-full bg-primary/60 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-mono text-foreground">{event.summary}</span>
                      {event.start && (
                        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {format(parseISO(event.start), "HH:mm")}
                          {event.end && ` — ${format(parseISO(event.end), "HH:mm")}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
