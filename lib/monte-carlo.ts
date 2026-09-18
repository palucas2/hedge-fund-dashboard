export type MonteCarloParams = {
  spot: number;
  strikePct: number; // ex 0.10 = put strike 10% sous le spot
  premiumPct: number; // ex 0.02 = prime = 2% du spot
  volAnnual: number; // ex 0.55 = 55% vol annualisée
  crashProb: number; // ex 0.05 = 5% de proba d'un choc de queue sur le cycle
  days: number; // durée du cycle (ex 30j)
  iterations: number; // ex 1000
};

export type MonteCarloResult = {
  meanPnl: number;
  stdevPnl: number;
  sharpeProjected: number | null;
  probLoss: number;
  histogram: { bin: string; count: number }[];
};

/** Box-Muller — pas de dépendance externe pour une gaussienne standard. */
function randomNormal(): number {
  const u1 = Math.random() || 1e-12;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Simulation Monte Carlo simplifiée d'un cycle "Wheel" (vente de put cash-secured) :
 * prix simulé par GBM (drift neutre) + choc de queue optionnel (crash) avec probabilité
 * `crashProb`. Pas de trajectoire intra-période (pas de SL réellement déclenché en cours
 * de route) — le put est jugé à l'échéance uniquement. `sl_triggered` désigne ici une
 * assignation "normale" (prix sous le strike sans choc de crash), `crash_slippage` une
 * assignation avec choc de queue déclenché.
 */
export function runWheelMonteCarlo(params: MonteCarloParams): MonteCarloResult {
  const { spot, strikePct, premiumPct, volAnnual, crashProb, days, iterations } = params;
  const T = days / 365;
  const strike = spot * (1 - strikePct);
  const premium = spot * premiumPct;
  const CRASH_SHOCK = -0.3; // choc de queue additionnel sur le log-return

  const pnls: number[] = [];
  let losses = 0;

  for (let i = 0; i < iterations; i++) {
    const z = randomNormal();
    const baseReturn = -0.5 * volAnnual ** 2 * T + volAnnual * Math.sqrt(T) * z;
    const crashed = Math.random() < crashProb;
    const terminal = spot * Math.exp(baseReturn + (crashed ? CRASH_SHOCK : 0));

    const pnl = terminal >= strike ? premium : premium - (strike - terminal);
    pnls.push(pnl);
    if (pnl < 0) losses++;
  }

  const meanPnl = pnls.reduce((a, b) => a + b, 0) / pnls.length;
  const variance = pnls.reduce((a, b) => a + (b - meanPnl) ** 2, 0) / (pnls.length - 1);
  const stdevPnl = Math.sqrt(variance);

  const min = Math.min(...pnls);
  const max = Math.max(...pnls);
  const bins = 20;
  const width = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const pnl of pnls) {
    const idx = Math.min(bins - 1, Math.floor((pnl - min) / width));
    counts[idx]++;
  }
  const histogram = counts.map((count, i) => ({
    bin: `${Math.round(min + i * width)}`,
    count,
  }));

  return {
    meanPnl: Math.round(meanPnl * 100) / 100,
    stdevPnl: Math.round(stdevPnl * 100) / 100,
    sharpeProjected: stdevPnl > 0 ? Math.round((meanPnl / stdevPnl) * 100) / 100 : null,
    probLoss: Math.round((losses / pnls.length) * 10000) / 100,
    histogram,
  };
}
