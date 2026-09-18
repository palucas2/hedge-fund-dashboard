/**
 * Dataset d'EXEMPLE pour l'Antecede Graph (Module 7) — 19 entités / ~50 relations,
 * thème défense/géopolitique, à remplacer par le vrai dataset de production.
 * Lancer avec : npx tsx prisma/seed-antecede.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const nodes = [
  // Companies
  { id: "rtx", name: "RTX (Raytheon)", type: "company", ticker: "RTX", description: "Défense — missiles, radars, systèmes Patriot." },
  { id: "lmt", name: "Lockheed Martin", type: "company", ticker: "LMT", description: "Défense — avions de combat, F-35." },
  { id: "noc", name: "Northrop Grumman", type: "company", ticker: "NOC", description: "Défense — drones, systèmes spatiaux." },
  { id: "tsmc", name: "TSMC", type: "company", ticker: "TSM", description: "Fonderie de semi-conducteurs, Taiwan." },
  { id: "sk_hynix", name: "SK Hynix", type: "company", ticker: "000660.KS", description: "Mémoire, Corée du Sud." },
  // Countries
  { id: "usa", name: "USA", type: "country", description: "Premier marché défense mondial, membre OTAN." },
  { id: "iran", name: "Iran", type: "country", description: "Contrôle partiel du détroit d'Ormuz.", chokepoint: true },
  { id: "china", name: "Chine", type: "country", description: "Producteur dominant de terres rares." },
  { id: "taiwan", name: "Taiwan", type: "country", description: "Cœur de la production mondiale de semi-conducteurs.", chokepoint: true },
  { id: "russia", name: "Russie", type: "country", description: "Producteur d'énergie, sanctionné." },
  { id: "ukraine", name: "Ukraine", type: "country", description: "Conflit actif avec la Russie." },
  { id: "saudi", name: "Arabie Saoudite", type: "country", description: "Premier exportateur OPEC+." },
  // Alliances
  { id: "nato", name: "NATO", type: "alliance", description: "Alliance militaire transatlantique." },
  { id: "opec_plus", name: "OPEC+", type: "alliance", description: "Cartel de coordination pétrolière." },
  // Resources
  { id: "rare_earths", name: "Terres rares", type: "resource", description: "Critiques pour l'électronique de défense." },
  { id: "crude_oil", name: "Pétrole brut", type: "resource", description: "Commodité énergétique stratégique." },
  { id: "semiconductors", name: "Semi-conducteurs", type: "resource", description: "Composant critique de toute l'électronique moderne." },
  // Programs
  { id: "f35_program", name: "F-35 Program", type: "program", description: "Programme d'avion de chasse multinational." },
  { id: "patriot", name: "Patriot", type: "program", description: "Système de défense anti-missile." },
];

const edges: {
  sourceId: string; targetId: string; edgeType: string; edgeCategory: string;
  weightFinancialPct?: number; direction?: string; status?: string; confidence?: string; chokepointType?: string; note?: string;
}[] = [
  { sourceId: "rtx", targetId: "patriot", edgeType: "manufactures", edgeCategory: "trade", weightFinancialPct: 35, direction: "positive", status: "active", confidence: "verified", note: "Fabricant principal du système Patriot." },
  { sourceId: "rtx", targetId: "usa", edgeType: "supplies", edgeCategory: "trade", weightFinancialPct: 20, direction: "positive", status: "active", confidence: "verified" },
  { sourceId: "rtx", targetId: "nato", edgeType: "partner", edgeCategory: "alliance", weightFinancialPct: 15, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "lmt", targetId: "f35_program", edgeType: "manufactures", edgeCategory: "trade", weightFinancialPct: 60, direction: "positive", status: "active", confidence: "verified", note: "Maître d'œuvre du F-35." },
  { sourceId: "lmt", targetId: "usa", edgeType: "supplies", edgeCategory: "trade", weightFinancialPct: 25, direction: "positive", status: "active", confidence: "verified" },
  { sourceId: "lmt", targetId: "nato", edgeType: "partner", edgeCategory: "alliance", weightFinancialPct: 20, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "noc", targetId: "usa", edgeType: "supplies", edgeCategory: "trade", weightFinancialPct: 15, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "noc", targetId: "f35_program", edgeType: "contributor", edgeCategory: "trade", weightFinancialPct: 10, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "f35_program", targetId: "nato", edgeType: "equips", edgeCategory: "alliance", weightFinancialPct: 30, direction: "positive", status: "active", confidence: "verified" },
  { sourceId: "patriot", targetId: "nato", edgeType: "equips", edgeCategory: "alliance", weightFinancialPct: 25, direction: "positive", status: "active", confidence: "verified" },
  { sourceId: "patriot", targetId: "ukraine", edgeType: "deployed_in", edgeCategory: "alliance", weightFinancialPct: 40, direction: "positive", status: "active", confidence: "high", note: "Systèmes Patriot livrés à l'Ukraine." },

  { sourceId: "tsmc", targetId: "taiwan", edgeType: "headquartered_in", edgeCategory: "dependency", weightFinancialPct: 80, direction: "positive", status: "active", confidence: "verified" },
  { sourceId: "tsmc", targetId: "semiconductors", edgeType: "produces", edgeCategory: "trade", weightFinancialPct: 55, direction: "positive", status: "active", confidence: "verified" },
  { sourceId: "sk_hynix", targetId: "semiconductors", edgeType: "produces", edgeCategory: "trade", weightFinancialPct: 20, direction: "positive", status: "active", confidence: "verified" },
  { sourceId: "semiconductors", targetId: "f35_program", edgeType: "critical_input", edgeCategory: "dependency", weightFinancialPct: 15, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "semiconductors", targetId: "patriot", edgeType: "critical_input", edgeCategory: "dependency", weightFinancialPct: 10, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "china", targetId: "rare_earths", edgeType: "controls_supply", edgeCategory: "dependency", weightFinancialPct: 70, direction: "positive", status: "active", confidence: "verified", note: "~70% de la production mondiale de terres rares." },
  { sourceId: "rare_earths", targetId: "f35_program", edgeType: "critical_input", edgeCategory: "dependency", weightFinancialPct: 20, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "rare_earths", targetId: "patriot", edgeType: "critical_input", edgeCategory: "dependency", weightFinancialPct: 15, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "china", targetId: "taiwan", edgeType: "territorial_claim", edgeCategory: "conflict", weightFinancialPct: 90, direction: "negative", status: "active", confidence: "verified", chokepointType: "taiwan_strait", note: "Détroit de Taiwan — chokepoint non-bypassable." },
  { sourceId: "china", targetId: "usa", edgeType: "trade_tension", edgeCategory: "conflict", weightFinancialPct: 45, direction: "negative", status: "active", confidence: "high" },

  { sourceId: "iran", targetId: "crude_oil", edgeType: "controls_route", edgeCategory: "dependency", weightFinancialPct: 60, direction: "positive", status: "active", confidence: "verified", chokepointType: "hormuz", note: "Détroit d'Ormuz — ~20% du pétrole mondial transite ici." },
  { sourceId: "iran", targetId: "usa", edgeType: "sanctions", edgeCategory: "conflict", weightFinancialPct: 50, direction: "negative", status: "active", confidence: "verified" },
  { sourceId: "iran", targetId: "saudi", edgeType: "regional_tension", edgeCategory: "conflict", weightFinancialPct: 40, direction: "negative", status: "active", confidence: "high" },
  { sourceId: "saudi", targetId: "opec_plus", edgeType: "member", edgeCategory: "alliance", weightFinancialPct: 35, direction: "positive", status: "active", confidence: "verified" },
  { sourceId: "saudi", targetId: "crude_oil", edgeType: "exports", edgeCategory: "trade", weightFinancialPct: 50, direction: "positive", status: "active", confidence: "verified" },
  { sourceId: "opec_plus", targetId: "crude_oil", edgeType: "coordinates_supply", edgeCategory: "dependency", weightFinancialPct: 45, direction: "positive", status: "active", confidence: "verified" },
  { sourceId: "russia", targetId: "opec_plus", edgeType: "partner", edgeCategory: "alliance", weightFinancialPct: 20, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "russia", targetId: "crude_oil", edgeType: "exports", edgeCategory: "trade", weightFinancialPct: 30, direction: "positive", status: "active", confidence: "verified" },
  { sourceId: "russia", targetId: "ukraine", edgeType: "conflict", edgeCategory: "conflict", weightFinancialPct: 95, direction: "negative", status: "active", confidence: "verified", note: "Conflit armé actif depuis 2022." },
  { sourceId: "russia", targetId: "usa", edgeType: "sanctions", edgeCategory: "conflict", weightFinancialPct: 55, direction: "negative", status: "active", confidence: "verified" },
  { sourceId: "russia", targetId: "nato", edgeType: "tension", edgeCategory: "conflict", weightFinancialPct: 60, direction: "negative", status: "active", confidence: "verified" },
  { sourceId: "ukraine", targetId: "nato", edgeType: "partner", edgeCategory: "alliance", weightFinancialPct: 30, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "usa", targetId: "nato", edgeType: "member", edgeCategory: "alliance", weightFinancialPct: 50, direction: "positive", status: "active", confidence: "verified" },
  { sourceId: "usa", targetId: "saudi", edgeType: "arms_sales", edgeCategory: "trade", weightFinancialPct: 25, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "usa", targetId: "taiwan", edgeType: "arms_sales", edgeCategory: "trade", weightFinancialPct: 20, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "usa", targetId: "iran", edgeType: "sanctions", edgeCategory: "conflict", weightFinancialPct: 50, direction: "negative", status: "active", confidence: "verified" },
  { sourceId: "usa", targetId: "china", edgeType: "trade_tension", edgeCategory: "conflict", weightFinancialPct: 45, direction: "negative", status: "active", confidence: "high" },
  { sourceId: "usa", targetId: "russia", edgeType: "sanctions", edgeCategory: "conflict", weightFinancialPct: 55, direction: "negative", status: "active", confidence: "verified" },
  { sourceId: "crude_oil", targetId: "usa", edgeType: "critical_input", edgeCategory: "dependency", weightFinancialPct: 20, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "semiconductors", targetId: "usa", edgeType: "critical_input", edgeCategory: "dependency", weightFinancialPct: 30, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "rare_earths", targetId: "usa", edgeType: "critical_input", edgeCategory: "dependency", weightFinancialPct: 25, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "taiwan", targetId: "usa", edgeType: "partner", edgeCategory: "alliance", weightFinancialPct: 30, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "tsmc", targetId: "usa", edgeType: "supplies", edgeCategory: "trade", weightFinancialPct: 35, direction: "positive", status: "active", confidence: "verified" },
  { sourceId: "sk_hynix", targetId: "usa", edgeType: "supplies", edgeCategory: "trade", weightFinancialPct: 15, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "noc", targetId: "nato", edgeType: "partner", edgeCategory: "alliance", weightFinancialPct: 12, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "china", targetId: "russia", edgeType: "partner", edgeCategory: "alliance", weightFinancialPct: 25, direction: "positive", status: "active", confidence: "high" },
  { sourceId: "iran", targetId: "russia", edgeType: "partner", edgeCategory: "alliance", weightFinancialPct: 20, direction: "positive", status: "active", confidence: "medium" },
  { sourceId: "china", targetId: "saudi", edgeType: "trade", edgeCategory: "trade", weightFinancialPct: 18, direction: "positive", status: "active", confidence: "high" },
];

async function main() {
  for (const n of nodes) {
    await prisma.antecedeNode.upsert({
      where: { id: n.id },
      update: n,
      create: n,
    });
  }
  await prisma.antecedeEdge.deleteMany({});
  await prisma.antecedeEdge.createMany({ data: edges });

  console.log(`Seeded ${nodes.length} nodes and ${edges.length} edges (dataset d'exemple).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
