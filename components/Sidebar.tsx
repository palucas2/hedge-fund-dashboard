"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { MODULES } from "@/lib/modules";
import { useGetUnreadAlertsCountQuery } from "@/lib/store/api";

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { data: alertsData } = useGetUnreadAlertsCountQuery(undefined, { pollingInterval: 2 * 60 * 1000 });
  const unreadAlerts = alertsData?.count ?? 0;

  return (
    <aside className="fixed left-0 top-0 z-20 flex h-screen w-[240px] flex-col border-r border-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <span className="text-lg font-semibold tracking-tight text-text-primary">
          HF Dashboard
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {MODULES.map((m) => {
          const active = pathname?.startsWith(m.path);
          return (
            <Link
              key={m.slug}
              href={m.path}
              className={`mx-2 mb-1 flex items-center gap-3 rounded-button px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-card text-text-primary"
                  : "text-text-secondary hover:bg-card/60 hover:text-text-primary"
              }`}
            >
              <span className="w-5 text-center">{m.icon}</span>
              <span className="flex-1">
                {m.index}. {m.label}
              </span>
              {m.slug === "volatility" && unreadAlerts > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-bear px-1 text-[10px] font-semibold text-white">
                  {unreadAlerts}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="mb-2 text-xs text-text-secondary">
          {session?.user?.name ?? session?.user?.email}
          <span className="ml-1 rounded bg-card px-1.5 py-0.5 text-[10px] uppercase text-link">
            {session?.user?.role}
          </span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="w-full rounded-button border border-border py-1.5 text-xs text-text-secondary hover:text-text-primary"
        >
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
