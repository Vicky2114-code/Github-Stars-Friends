"use client";

/**
 * Star history area chart. Client component because Recharts uses DOM.
 *
 * The slot fetches data server-side, this component renders it.
 *
 * Visual: gradient-filled area chart on dark background, axes hidden, minimal
 * tooltip on hover, "sampled" footnote when applicable.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { StarHistoryPoint } from "@/lib/star-history";

export type StarHistoryChartProps = {
  points: StarHistoryPoint[];
  sampled: boolean;
  pagesFetched: number;
};

export function StarHistoryChart({
  points,
  sampled,
  pagesFetched,
}: StarHistoryChartProps) {
  if (points.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-zinc-500">
        No stars yet — your first star awaits
      </div>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-zinc-400">
          <span className="tabular-nums text-zinc-200">
            {last.stars.toLocaleString()}
          </span>{" "}
          stars
        </span>
        <span className="text-zinc-500">
          {first.date.slice(0, 10)} → {last.date.slice(0, 10)}
        </span>
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="starGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickFormatter={(d: string) => d.slice(0, 7)}
              minTickGap={40}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickFormatter={(n: number) =>
                n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
              }
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#09090b",
                border: "1px solid #27272a",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#a1a1aa" }}
              itemStyle={{ color: "#fbbf24" }}
              labelFormatter={(d) => (typeof d === "string" ? d.slice(0, 10) : "")}
              formatter={(v) =>
                typeof v === "number"
                  ? [v.toLocaleString(), "stars"]
                  : [String(v), "stars"]
              }
            />
            <Area
              type="monotone"
              dataKey="stars"
              stroke="#fbbf24"
              strokeWidth={2}
              fill="url(#starGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {sampled && (
        <p className="text-xs text-zinc-600">
          Sampled across {pagesFetched} pages — GitHub caps stargazers
          pagination at page 400 (~40k stars). For larger repos this is
          early-history only.
        </p>
      )}
    </div>
  );
}
