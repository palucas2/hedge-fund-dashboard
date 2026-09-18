/**
 * Calendrier codé en dur — spec Module 9 ("calendrier banques centrales codé en dur +
 * scrapé mensuellement"). Dates vérifiées le 2026-09-06 sur les calendriers officiels
 * (federalreserve.gov, ecb.europa.eu, bankofengland.co.uk, boj.or.jp, rba.gov.au).
 * Horaires d'annonce best-effort (fuseau/heure d'été appliqués manuellement) — à
 * revérifier à l'approche de chaque réunion, en particulier pour la BoJ (pas d'heure
 * officielle fixe).
 */
export type CentralBankMeeting = {
  bank: string;
  date: string; // ISO UTC
  label: string;
};

export const CENTRAL_BANK_CALENDAR: CentralBankMeeting[] = [
  { bank: "Fed (FOMC)", date: "2026-09-16T18:00:00Z", label: "Décision de taux + conférence de presse" },
  { bank: "ECB", date: "2026-09-10T12:15:00Z", label: "Décision de taux + conférence de presse" },
  { bank: "BoE", date: "2026-09-17T11:00:00Z", label: "Décision de taux" },
  { bank: "BoJ", date: "2026-09-18T03:00:00Z", label: "Décision de taux (horaire indicatif)" },
  { bank: "RBA", date: "2026-09-29T04:30:00Z", label: "Décision de taux" },

  { bank: "Fed (FOMC)", date: "2026-10-28T18:00:00Z", label: "Décision de taux + conférence de presse" },
  { bank: "ECB", date: "2026-10-29T12:15:00Z", label: "Décision de taux + conférence de presse" },
  { bank: "BoJ", date: "2026-10-30T03:00:00Z", label: "Décision de taux (horaire indicatif)" },
  { bank: "RBA", date: "2026-11-03T03:30:00Z", label: "Décision de taux" },
  { bank: "BoE", date: "2026-11-05T12:00:00Z", label: "Décision de taux" },

  { bank: "Fed (FOMC)", date: "2026-12-09T19:00:00Z", label: "Décision de taux + conférence de presse" },
  { bank: "RBA", date: "2026-12-08T03:30:00Z", label: "Décision de taux" },
  { bank: "ECB", date: "2026-12-17T13:15:00Z", label: "Décision de taux + conférence de presse" },
  { bank: "BoJ", date: "2026-12-18T03:00:00Z", label: "Décision de taux (horaire indicatif)" },
  { bank: "BoE", date: "2026-12-17T12:00:00Z", label: "Décision de taux" },
];

export function getUpcomingMeetings(count = 8): CentralBankMeeting[] {
  const now = Date.now();
  return CENTRAL_BANK_CALENDAR.filter((m) => new Date(m.date).getTime() > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, count);
}

/** Réunions dans les 30 prochaines minutes — spec : "pré-alerte 30 minutes avant chaque décision". */
export function getImminentMeetings(): CentralBankMeeting[] {
  const now = Date.now();
  const in30min = now + 30 * 60 * 1000;
  return CENTRAL_BANK_CALENDAR.filter((m) => {
    const t = new Date(m.date).getTime();
    return t > now && t <= in30min;
  });
}

/** Réunions dont l'annonce est passée dans la dernière heure — pour créer l'alerte "décision tombée". */
export function getJustAnnouncedMeetings(): CentralBankMeeting[] {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  return CENTRAL_BANK_CALENDAR.filter((m) => {
    const t = new Date(m.date).getTime();
    return t <= now && t > hourAgo;
  });
}
