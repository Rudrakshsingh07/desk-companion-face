import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { format } from "date-fns";

type NotificationItem = {
  id: string;
  app?: string;
  title?: string;
  body?: string;
  timestamp?: string;
};

export function NotificationsWidget() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch("/api/notifications");
        const data = await res.json();
        if (!alive) return;
        setItems((data.notifications ?? []) as NotificationItem[]);
      } catch {
        if (!alive) return;
        setItems([]);
      }
    };

    void load();
    const interval = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <button
        className="lcd-button h-full w-full flex flex-col items-center justify-center gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Bell className="w-5 h-5 text-primary relative z-10" />
        <span className="text-[9px] font-mono text-primary lcd-text relative z-10">
          {items.length > 0 ? `${items.length} notif${items.length > 1 ? "s" : ""}` : "Notifications"}
        </span>
      </button>

      {open && (
        <div className="overlay-backdrop" onClick={() => setOpen(false)}>
          <div
            className="overlay-panel w-96 max-h-[75vh] p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="macropad-screw" />
                <div className="lcd-display px-3 py-1.5 flex items-center gap-2 text-sm font-mono text-primary">
                  <Bell className="w-4 h-4" />
                  <span className="lcd-text">Notifications</span>
                </div>
              </div>
              <button className="metal-close-btn" onClick={() => setOpen(false)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="lcd-display flex flex-col items-center py-8 gap-2 relative z-10">
                <Bell className="w-8 h-8 text-primary/50 relative z-10" />
                <span className="text-sm font-mono text-primary/90 lcd-text relative z-10">No notifications</span>
                <span className="text-[10px] font-mono text-primary/50 relative z-10 text-center px-6">
                  Waiting for device notifications.
                </span>
              </div>
            ) : (
              <div className="lcd-display flex flex-col gap-1 overflow-y-auto p-4 max-h-[50vh] relative z-10">
                {items.map((n) => (
                  <div
                    key={n.id}
                    className="flex flex-col gap-0.5 py-2.5 border-b border-primary/10 last:border-0 relative z-10"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-mono text-primary lcd-text truncate">
                        {n.title || n.app || "Notification"}
                      </span>
                      <span className="text-[10px] font-mono text-primary/35 shrink-0">
                        {n.timestamp ? format(new Date(n.timestamp), "HH:mm") : ""}
                      </span>
                    </div>
                    {n.body && (
                      <span className="text-[10px] font-mono text-primary/80 leading-snug">
                        {n.body}
                      </span>
                    )}
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

