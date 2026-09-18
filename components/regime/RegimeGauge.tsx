"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { RegimeResult } from "@/lib/regime";

const COLORS = { bull: "#26A69A", bear: "#EF5350", lateral: "#FFA726" } as const;
const DOTS = { bull: "🟢", bear: "🔴", lateral: "🟡" } as const;

const BG_TINT = { bull: "bg-bull/10 border-bull/40", bear: "bg-bear/10 border-bear/40", lateral: "bg-lateral/10 border-lateral/40" } as const;

export default function RegimeGauge({ result }: { result: RegimeResult }) {
  const data = [
    { name: "Bull", value: result.bull, key: "bull" as const },
    { name: "Bear", value: result.bear, key: "bear" as const },
    { name: "Lateral", value: result.lateral, key: "lateral" as const },
  ];

  return (
    <div className={`rounded-card border p-4 ${BG_TINT[result.regime]}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{result.label}</span>
        <span className="text-lg">{DOTS[result.regime]}</span>
      </div>

      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={30} outerRadius={50} strokeWidth={0}>
              {data.map((d) => (
                <Cell key={d.key} fill={COLORS[d.key]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#12141c", border: "1px solid #262936", borderRadius: 8, fontSize: 12 }}
              formatter={(value) => `${value}%`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 flex justify-center gap-3 text-xs">
        <span className="text-bull">Bull {result.bull}%</span>
        <span className="text-bear">Bear {result.bear}%</span>
        <span className="text-lateral">Lateral {result.lateral}%</span>
      </div>
    </div>
  );
}
