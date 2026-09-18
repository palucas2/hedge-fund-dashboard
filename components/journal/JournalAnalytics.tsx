import StatCard from "@/components/StatCard";
import EquityCurveChart from "@/components/EquityCurveChart";
import type { TradeDTO } from "@/lib/types";
import {
  computeEquityCurve,
  computeTradeStats,
  pnlByAsset,
  pnlByMonth,
  pnlByWeekday,
  topTrades,
  winRateByStrategy,
} from "@/lib/trade-metrics";

function fmtUsd(v: number | null) {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(v: number | null) {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export default function JournalAnalytics({ trades }: { trades: TradeDTO[] }) {
  const stats = computeTradeStats(trades);
  const equity = computeEquityCurve(trades);
  const byStrategy = winRateByStrategy(trades);
  const byWeekday = pnlByWeekday(trades);
  const byMonth = pnlByMonth(trades);
  const byAsset = pnlByAsset(trades);
  const best = topTrades(trades, 5, true);
  const worst = topTrades(trades, 5, false);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Win rate" value={stats.winRate !== null ? `${(stats.winRate * 100).toFixed(0)}%` : "—"} />
        <StatCard
          label="Profit factor"
          value={stats.profitFactor === null ? "—" : stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
        />
        <StatCard label="Avg win / loss" value={stats.avgWinLossRatio !== null ? stats.avgWinLossRatio.toFixed(2) : "—"} />
        <StatCard label="Trades (total / W / L)" value={`${stats.total} / ${stats.wins} / ${stats.losses}`} />
        <StatCard label="PnL total" value={fmtUsd(stats.totalPnlUsd)} tone={stats.totalPnlUsd >= 0 ? "bull" : "bear"} big />
        <StatCard label="Avg win" value={fmtUsd(stats.avgWin)} tone="bull" />
        <StatCard label="Avg loss" value={stats.avgLoss !== null ? `-$${stats.avgLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"} tone="bear" />
        <StatCard label="Max drawdown" value={stats.maxDrawdownUsd !== null ? `$${stats.maxDrawdownUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"} tone="bear" />
      </div>

      <div className="rounded-card border border-border bg-card p-4">
        <div className="mb-2 text-sm font-medium text-text-primary">Equity curve (tous trades clôturés)</div>
        <EquityCurveChart data={equity} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-card border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium text-text-primary">Win rate par stratégie</div>
          {byStrategy.length === 0 ? (
            <p className="text-sm text-text-secondary">Pas encore de trades clôturés.</p>
          ) : (
            <div className="space-y-2">
              {byStrategy.map((s) => (
                <div key={s.strategy} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">
                    {s.strategy} <span className="text-xs">({s.count})</span>
                  </span>
                  <span className="font-mono text-text-primary">{(s.winRate * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-card border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium text-text-primary">PnL par asset</div>
          {byAsset.length === 0 ? (
            <p className="text-sm text-text-secondary">Pas encore de trades clôturés.</p>
          ) : (
            <div className="space-y-2">
              {byAsset.slice(0, 8).map((a) => (
                <div key={a.asset} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">
                    {a.asset} <span className="text-xs">({a.count})</span>
                  </span>
                  <span className={`font-mono ${a.pnl >= 0 ? "text-bull" : "text-bear"}`}>{fmtUsd(a.pnl)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-card border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium text-text-primary">PnL par jour de semaine</div>
          <div className="space-y-2">
            {byWeekday.map((d) => (
              <div key={d.day} className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">{d.day}</span>
                <span className={`font-mono ${d.pnl >= 0 ? "text-bull" : "text-bear"}`}>{fmtUsd(d.pnl)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-card border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium text-text-primary">PnL par mois</div>
          {byMonth.length === 0 ? (
            <p className="text-sm text-text-secondary">Pas encore de trades clôturés.</p>
          ) : (
            <div className="space-y-2">
              {byMonth.map((m) => (
                <div key={m.month} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{m.month}</span>
                  <span className={`font-mono ${m.pnl >= 0 ? "text-bull" : "text-bear"}`}>{fmtUsd(m.pnl)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-card border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium text-text-primary">Top 5 meilleurs trades</div>
          {best.length === 0 ? (
            <p className="text-sm text-text-secondary">—</p>
          ) : (
            <div className="space-y-2">
              {best.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{t.asset}</span>
                  <span className="font-mono text-bull">
                    {fmtUsd(t.pnlUsd)} ({fmtPct(t.pnlPct)})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-card border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium text-text-primary">Top 5 pires trades</div>
          {worst.length === 0 ? (
            <p className="text-sm text-text-secondary">—</p>
          ) : (
            <div className="space-y-2">
              {worst.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{t.asset}</span>
                  <span className="font-mono text-bear">
                    {fmtUsd(t.pnlUsd)} ({fmtPct(t.pnlPct)})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
