import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const content = `## Global Session Wrap
- US equities closed mixed, S&P 500 flat on the day.
- Treasury yields ticked up 3bps on hawkish Fed commentary.

## ASX Pre-Open
- ASX 200 futures point to a modest opening gain.

## Inde
- Nifty 50 extended gains on strong IT earnings.

## Commodities FX Crypto
- Gold steady near record highs amid geopolitical tension.
- BTC holding above $79k.

## Deep Stories
- Iran-US tensions in the Strait of Hormuz continue to pressure oil markets.

## On The Radar
- FOMC minutes due this week.

## Rapid Fire
- Chevron beats on Iraq output.
- Lululemon guidance cut, shares down 18%.

## Alpha Conviction
- Long AMAT on semiconductor capex tailwind, targeting a 3-month horizon.

## Tail Risk
- Escalation risk in the Strait of Hormuz could spike oil >15% overnight.`;

await prisma.marketRecap.create({
  data: {
    date: new Date(new Date().toDateString()),
    content,
    modelUsed: "test-seed",
  },
});
console.log("test recap seeded");
await prisma.$disconnect();
