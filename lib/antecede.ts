import { prisma } from "@/lib/prisma";
import { serializeAntecedeEdge, serializeAntecedeNode } from "@/lib/serialize";
import type { AntecedeEdgeDTO, AntecedeNodeDTO } from "@/lib/types";
import { getAnthropicClient } from "@/lib/anthropic-client";
import type Anthropic from "@anthropic-ai/sdk";

export type AntecedeGraph = { nodes: AntecedeNodeDTO[]; edges: AntecedeEdgeDTO[] };

export async function getFullGraph(): Promise<AntecedeGraph> {
  const [nodes, edges] = await Promise.all([
    prisma.antecedeNode.findMany(),
    prisma.antecedeEdge.findMany(),
  ]);
  return { nodes: nodes.map(serializeAntecedeNode), edges: edges.map(serializeAntecedeEdge) };
}

/** Subgraph : le nœud demandé + ses voisins directs (spec : "clic sur un node" / "Analyser avec Claude"). */
export async function getSubgraph(nodeId: string): Promise<AntecedeGraph | null> {
  const node = await prisma.antecedeNode.findUnique({ where: { id: nodeId } });
  if (!node) return null;

  const edges = await prisma.antecedeEdge.findMany({
    where: { OR: [{ sourceId: nodeId }, { targetId: nodeId }] },
  });

  const neighborIds = new Set<string>([nodeId]);
  for (const e of edges) {
    neighborIds.add(e.sourceId);
    neighborIds.add(e.targetId);
  }

  const nodes = await prisma.antecedeNode.findMany({ where: { id: { in: Array.from(neighborIds) } } });

  return { nodes: nodes.map(serializeAntecedeNode), edges: edges.map(serializeAntecedeEdge) };
}

/** Spec Module 7 : "Analyser avec Claude" — envoie le subgraph de l'entité, propose un trade. */
export async function analyzeEntityWithClaude(nodeId: string): Promise<string | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const subgraph = await getSubgraph(nodeId);
  if (!subgraph) return null;

  const description = subgraph.nodes
    .map((n) => `- ${n.name} (${n.type}${n.chokepoint ? ", chokepoint" : ""})${n.description ? `: ${n.description}` : ""}`)
    .join("\n");
  const relations = subgraph.edges
    .map((e) => {
      const from = subgraph.nodes.find((n) => n.id === e.sourceId)?.name ?? e.sourceId;
      const to = subgraph.nodes.find((n) => n.id === e.targetId)?.name ?? e.targetId;
      return `- ${from} → ${to} (${e.edgeType}, ${e.edgeCategory}${e.weightFinancialPct ? `, poids ${e.weightFinancialPct}%` : ""})`;
    })
    .join("\n");

  const focusNode = subgraph.nodes.find((n) => n.id === nodeId);

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1500,
    system:
      "Tu es analyste géopolitique pour un hedge fund. À partir d'un sous-graphe d'entités et relations, propose UNE idée de trade concrète et argumentée (asset, direction, thèse en 3-4 phrases). Sois direct et actionnable.",
    messages: [
      {
        role: "user",
        content: `Entité analysée : ${focusNode?.name ?? nodeId}\n\nEntités du sous-graphe :\n${description}\n\nRelations :\n${relations}`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export async function searchNodes(query: string): Promise<AntecedeNodeDTO[]> {
  const nodes = await prisma.antecedeNode.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    take: 10,
  });
  return nodes.map(serializeAntecedeNode);
}
