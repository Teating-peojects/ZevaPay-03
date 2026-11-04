"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ActivityPoint } from "@/types/api";

const SERIES = [
  { key: "success", label: "Confirmed from SMS", color: "#10b981" },
  { key: "pending", label: "Awaiting verification", color: "#f59e0b" },
  { key: "failed", label: "Verification failed", color: "#ef4444" },
] as const;

/**
 * Stacked activity chart for the overview pages. Values are counts of
 * transactions per status per day.
 */
export function ActivityChart({
  data,
  className,
}: {
  data: ActivityPoint[];
  className?: string;
}) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgb(15 23 42 / 0.07)",
              fontSize: 13,
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={32}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "#475569" }}
          />
          {SERIES.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              fill={series.color}
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
