/**
 * Hidden Markov Model gaussien à K états, entraîné par Baum-Welch (EM) — implémentation
 * "from scratch" (forward-backward mis à l'échelle pour la stabilité numérique), sans
 * dépendance externe. Utilisé par lib/regime.ts pour classer Bull/Bear/Lateral à partir
 * des rendements journaliers réels (voir lib/yahoo-finance.ts).
 *
 * Référence standard : Rabiner (1989), "A Tutorial on Hidden Markov Models...".
 */

export type HmmFit = {
  k: number;
  pi: number[];
  A: number[][]; // A[i][j] = P(état j au temps t+1 | état i au temps t)
  mu: number[];
  sigma: number[];
  gamma: number[][]; // gamma[t][k] = P(état k au temps t | toutes les observations)
  logLikelihood: number;
};

function gaussianPdf(x: number, mu: number, sigma: number): number {
  const s = Math.max(sigma, 1e-8);
  const z = (x - mu) / s;
  return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI));
}

function initParams(observations: number[], k: number) {
  const sorted = [...observations].sort((a, b) => a - b);
  const n = sorted.length;
  const mu: number[] = [];
  const sigma: number[] = [];
  for (let i = 0; i < k; i++) {
    const start = Math.floor((i / k) * n);
    const end = Math.floor(((i + 1) / k) * n) || 1;
    const bucket = sorted.slice(start, end);
    const mean = bucket.reduce((a, b) => a + b, 0) / (bucket.length || 1);
    const variance = bucket.reduce((a, b) => a + (b - mean) ** 2, 0) / (bucket.length || 1);
    mu.push(mean);
    sigma.push(Math.sqrt(variance) || 0.001);
  }

  // Prior de persistance de régime : rester dans l'état courant est plus probable que switcher.
  const stay = 0.92;
  const A = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) => (i === j ? stay : (1 - stay) / (k - 1)))
  );
  const pi = new Array(k).fill(1 / k);

  return { pi, A, mu, sigma };
}

export function fitGaussianHmm(observations: number[], k: number, maxIterations = 100): HmmFit {
  const T = observations.length;
  let { pi, A, mu, sigma } = initParams(observations, k);
  let logLikelihood = -Infinity;

  for (let iter = 0; iter < maxIterations; iter++) {
    const B: number[][] = Array.from({ length: T }, (_, t) =>
      Array.from({ length: k }, (_, i) => gaussianPdf(observations[t], mu[i], sigma[i]))
    );

    // Forward, mis à l'échelle
    const alpha: number[][] = Array.from({ length: T }, () => new Array(k).fill(0));
    const c: number[] = new Array(T).fill(0);

    for (let i = 0; i < k; i++) alpha[0][i] = pi[i] * B[0][i];
    c[0] = alpha[0].reduce((a, b) => a + b, 0) || 1e-300;
    for (let i = 0; i < k; i++) alpha[0][i] /= c[0];

    for (let t = 1; t < T; t++) {
      for (let j = 0; j < k; j++) {
        let sum = 0;
        for (let i = 0; i < k; i++) sum += alpha[t - 1][i] * A[i][j];
        alpha[t][j] = sum * B[t][j];
      }
      c[t] = alpha[t].reduce((a, b) => a + b, 0) || 1e-300;
      for (let j = 0; j < k; j++) alpha[t][j] /= c[t];
    }

    // Backward, mis à l'échelle avec les mêmes constantes c[t]
    const beta: number[][] = Array.from({ length: T }, () => new Array(k).fill(1));
    for (let t = T - 2; t >= 0; t--) {
      for (let i = 0; i < k; i++) {
        let sum = 0;
        for (let j = 0; j < k; j++) sum += A[i][j] * B[t + 1][j] * beta[t + 1][j];
        beta[t][i] = sum / c[t + 1];
      }
    }

    // gamma[t][k], xi[t][i][j]
    const gamma: number[][] = Array.from({ length: T }, (_, t) => {
      const raw = alpha[t].map((a, i) => a * beta[t][i]);
      const sum = raw.reduce((a, b) => a + b, 0) || 1e-300;
      return raw.map((v) => v / sum);
    });

    const xiSum: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
    const gammaSumExclLast: number[] = new Array(k).fill(0);
    for (let t = 0; t < T - 1; t++) {
      for (let i = 0; i < k; i++) {
        gammaSumExclLast[i] += gamma[t][i];
        for (let j = 0; j < k; j++) {
          xiSum[i][j] += (alpha[t][i] * A[i][j] * B[t + 1][j] * beta[t + 1][j]) / c[t + 1];
        }
      }
    }

    // M-step
    pi = gamma[0].slice();
    A = xiSum.map((row, i) => row.map((v) => v / (gammaSumExclLast[i] || 1e-300)));

    const gammaSumAll = new Array(k).fill(0);
    for (let t = 0; t < T; t++) for (let i = 0; i < k; i++) gammaSumAll[i] += gamma[t][i];

    mu = mu.map((_, i) => {
      let sum = 0;
      for (let t = 0; t < T; t++) sum += gamma[t][i] * observations[t];
      return sum / (gammaSumAll[i] || 1e-300);
    });
    sigma = sigma.map((_, i) => {
      let sum = 0;
      for (let t = 0; t < T; t++) sum += gamma[t][i] * (observations[t] - mu[i]) ** 2;
      return Math.sqrt(sum / (gammaSumAll[i] || 1e-300)) || 1e-4;
    });

    const newLogLikelihood = c.reduce((sum, ct) => sum + Math.log(ct), 0);
    if (Math.abs(newLogLikelihood - logLikelihood) < 1e-6) {
      logLikelihood = newLogLikelihood;
      break;
    }
    logLikelihood = newLogLikelihood;
  }

  // Repasse finale pour renvoyer le gamma cohérent avec les paramètres convergés
  const B: number[][] = Array.from({ length: T }, (_, t) =>
    Array.from({ length: k }, (_, i) => gaussianPdf(observations[t], mu[i], sigma[i]))
  );
  const alpha: number[][] = Array.from({ length: T }, () => new Array(k).fill(0));
  const c: number[] = new Array(T).fill(0);
  for (let i = 0; i < k; i++) alpha[0][i] = pi[i] * B[0][i];
  c[0] = alpha[0].reduce((a, b) => a + b, 0) || 1e-300;
  for (let i = 0; i < k; i++) alpha[0][i] /= c[0];
  for (let t = 1; t < T; t++) {
    for (let j = 0; j < k; j++) {
      let sum = 0;
      for (let i = 0; i < k; i++) sum += alpha[t - 1][i] * A[i][j];
      alpha[t][j] = sum * B[t][j];
    }
    c[t] = alpha[t].reduce((a, b) => a + b, 0) || 1e-300;
    for (let j = 0; j < k; j++) alpha[t][j] /= c[t];
  }
  const beta: number[][] = Array.from({ length: T }, () => new Array(k).fill(1));
  for (let t = T - 2; t >= 0; t--) {
    for (let i = 0; i < k; i++) {
      let sum = 0;
      for (let j = 0; j < k; j++) sum += A[i][j] * B[t + 1][j] * beta[t + 1][j];
      beta[t][i] = sum / c[t + 1];
    }
  }
  const gamma: number[][] = Array.from({ length: T }, (_, t) => {
    const raw = alpha[t].map((a, i) => a * beta[t][i]);
    const sum = raw.reduce((a, b) => a + b, 0) || 1e-300;
    return raw.map((v) => v / sum);
  });

  return { k, pi, A, mu, sigma, gamma, logLikelihood };
}
