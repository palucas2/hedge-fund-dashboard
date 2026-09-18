"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EquityPoint } from "@/lib/trade-metrics";

export default function EquityCurveChart({ data }: { data: EquityPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-text-secondary">
        Pas encore de trades clôturés — l'equity curve apparaîtra ici.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#262936" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#9396a1" fontSize={11} tickLine={false} />
          <YAxis stroke="#9396a1" fontSize={11} tickLine={false} width={70} />
          <Tooltip
            contentStyle={{ background: "#12141c", border: "1px solid #262936", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#9396a1" }}
            itemStyle={{ color: "#e6e7ec" }}
          />
          <Line
            type="monotone"
            dataKey="cumulativePnl"
            name="PnL cumulé ($)"
            stroke="#5a8de8"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
