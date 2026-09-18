import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, isAnthropicConfigured } from "@/lib/anthropic-client";

/** Les 9 sections du format Market Recap (spec Module 6). */
export const MARKET_RECAP_SECTIONS = [
  "Global Session Wrap",
  "ASX Pre-Open",
  "Inde",
  "Commodities FX Crypto",
  "Deep Stories",
  "On The Radar",
  "Rapid Fire",
  "Alpha Conviction",
  "Tail Risk",
] as const;

const DEFAULT_PROMPT = `Tu es l'analyste en chef d'un hedge fund. Génère le "Market Recap" quotidien en anglais financier concis, structuré EXACTEMENT selon ces 9 sections, dans cet ordre, avec ces titres en gras (## Titre) :

${MARKET_RECAP_SECTIONS.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Utilise la recherche web pour baser le brief sur l'actualité des 6 dernières heures (marchés, banques centrales, géopolitique, earnings). Sois factuel, dense, avec des bullet points. La section "Alpha Conviction" doit proposer une idée de trade concrète et argumentée. La section "Tail Risk" doit lister les risques de queue à surveiller.`;

export const isMarketRecapConfigured = isAnthropicConfigured;

function getPrompt() {
  return process.env.MARKET_RECAP_PROMPT?.trim() || DEFAULT_PROMPT;
}

export async function generateMarketRecap(): Promise<{ content: string; modelUsed: string } | null> {
  const client = getAnthropicClient();
  if (!client) return null;
  const model = "claude-opus-5";

  const stream = client.messages.stream({
    model,
    max_tokens: 8000,
    system: getPrompt(),
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
    messages: [
      {
        role: "user",
        content: "Génère le Market Recap du jour maintenant, basé sur les toutes dernières actualités.",
      },
    ],
  });

  const response = await stream.finalMessage();
  const content = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");

  return { content, modelUsed: model };
}
