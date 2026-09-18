import { prisma } from "@/lib/prisma";
import { getGeopoliticalNews } from "@/lib/news";
import { getImminentMeetings, getJustAnnouncedMeetings } from "@/lib/central-bank-calendar";
import { detectAbnormalPriceMoves, detectEarningsSurprises, detectUnusualVolume } from "@/lib/market-events";

/**
 * Pas d'infra de cron job dédiée dans ce déploiement (spec : "cron toutes les 5 min").
 * On simule le même effet en appelant ce scan à chaque poll client (page Volatility,
 * toutes les 2 min) — suffisant pour un outil interne mono-tenant, dédupliqué en base
 * pour ne jamais créer deux fois la même alerte.
 */
export async function scanForNewAlerts(): Promise<number> {
  let created = 0;

  // Catégorie 3 — Conflits géopolitiques (réutilise le pipeline RSS/NewsAPI du Module 1)
  const news = await getGeopoliticalNews(24);
  const geopoliticalNews = news.filter((n) => n.category === "geopolitical");
  for (const article of geopoliticalNews) {
    const existing = await prisma.alert.findFirst({
      where: { type: "geopolitical", description: { contains: article.url } },
    });
    if (existing) continue;

    await prisma.alert.create({
      data: {
        type: "geopolitical",
        asset: article.locationName,
        title: article.title,
        description: `${article.summary}\n\nSource: ${article.url}`,
        severity: "red",
        relevanceScore: 3,
      },
    });
    created++;
  }

  // Catégorie 4 — Décisions banques centrales (pré-alerte 30 min avant + décision tombée)
  for (const meeting of getImminentMeetings()) {
    const title = `Pré-alerte — ${meeting.bank} dans 30 min`;
    const existing = await prisma.alert.findFirst({ where: { type: "central_bank", title } });
    if (existing) continue;

    await prisma.alert.create({
      data: {
        type: "central_bank",
        asset: meeting.bank,
        title,
        description: meeting.label,
        severity: "orange",
        relevanceScore: 4,
      },
    });
    created++;
  }

  for (const meeting of getJustAnnouncedMeetings()) {
    const title = `${meeting.bank} — décision tombée (${meeting.date.slice(0, 10)})`;
    const existing = await prisma.alert.findFirst({ where: { type: "central_bank", title } });
    if (existing) continue;

    await prisma.alert.create({
      data: {
        type: "central_bank",
        asset: meeting.bank,
        title,
        description: `${meeting.label} — vérifie le mouvement des marchés en direct.`,
        severity: "red",
        relevanceScore: 5,
      },
    });
    created++;
  }

  // Catégorie 1 — Earnings Surprises (Alpha Vantage — spec : EPS réel vs attendu ±10%)
  for (const event of await detectEarningsSurprises()) {
    const title = `Earnings Surprise — ${event.ticker} (${event.reportedDate})`;
    const existing = await prisma.alert.findFirst({ where: { type: "earnings", title } });
    if (existing) continue;

    await prisma.alert.create({
      data: {
        type: "earnings",
        asset: event.ticker,
        title,
        description: `EPS réel : $${event.reportedEPS} vs $${event.estimatedEPS} attendu (${event.surprisePct >= 0 ? "+" : ""}${event.surprisePct}%).`,
        severity: Math.abs(event.surprisePct) >= 20 ? "red" : "orange",
        relevanceScore: Math.abs(event.surprisePct) >= 20 ? 5 : 4,
      },
    });
    created++;
  }

  // Catégorie 2 — Volume inhabituel (Yahoo Finance, gratuit, sans clé)
  const today = new Date().toISOString().slice(0, 10);
  for (const event of await detectUnusualVolume()) {
    const title = `Volume inhabituel — ${event.ticker} (${today})`;
    const existing = await prisma.alert.findFirst({ where: { type: "volume", title } });
    if (existing) continue;

    await prisma.alert.create({
      data: {
        type: "volume",
        asset: event.ticker,
        title,
        description: `Volume ${event.ratio}x la moyenne 20 jours — ${event.direction === "accumulation" ? "accumulation (prix en hausse)" : "distribution (prix en baisse)"}.`,
        severity: event.ratio >= 3 ? "red" : "orange",
        relevanceScore: event.ratio >= 3 ? 4 : 3,
      },
    });
    created++;
  }

  // Catégorie 5 — Mouvements de prix anormaux, ±3%/<1h (Yahoo Finance intraday, gratuit, sans clé)
  const hourBucket = new Date().toISOString().slice(0, 13); // dédup par heure glissante
  for (const event of await detectAbnormalPriceMoves()) {
    const title = `Mouvement de prix anormal — ${event.ticker} (${hourBucket}h)`;
    const existing = await prisma.alert.findFirst({ where: { type: "price_move", title } });
    if (existing) continue;

    await prisma.alert.create({
      data: {
        type: "price_move",
        asset: event.ticker,
        title,
        description: `${event.ticker} a bougé de ${event.changePct >= 0 ? "+" : ""}${event.changePct}% en moins d'1h.`,
        severity: Math.abs(event.changePct) >= 5 ? "red" : "orange",
        relevanceScore: Math.abs(event.changePct) >= 5 ? 4 : 3,
      },
    });
    created++;
  }

  return created;
}
