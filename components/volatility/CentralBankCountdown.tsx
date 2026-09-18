"use client";

import { useEffect, useState } from "react";
import type { CentralBankMeeting } from "@/lib/central-bank-calendar";

function formatCountdown(ms: number) {
  if (ms <= 0) return "En cours";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

export default function CentralBankCountdown({ meetings }: { meetings: CentralBankMeeting[] }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="mb-3 text-sm font-medium text-text-primary">Calendrier banques centrales</div>
      <div className="space-y-2">
        {meetings.map((m, i) => {
          const remaining = new Date(m.date).getTime() - now;
          const imminent = remaining > 0 && remaining <= 30 * 60 * 1000;
          return (
            <div key={i} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-text-primary">{m.bank}</span>{" "}
                <span className="text-xs text-text-secondary">— {m.label}</span>
              </div>
              <span className={`font-mono text-xs ${imminent ? "text-bear" : "text-text-secondary"}`}>
                {formatCountdown(remaining)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
