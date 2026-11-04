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

/*
 * Colours come from the design-system CSS variables, not hex literals, so the
 * chart follows the light/dark theme like every other surface. Series fills
 * use the status `-fg` tokens, which are re-tuned per theme for contrast.
 */
const SERIES = [
  { key: "success", label: "Confirmed from SMS", color: "var(--zp-success-fg)" },
  { key: "pending", label: "Awaiting verification", color: "var(--zp-warning-fg)" },
  { key: "failed", label: "Verification failed", color: "var(--zp-danger-fg)" },
] as const;

const GRID = "var(--zp-line)";
const TICK = { fill: "var(--zp-fg-muted)", fontSize: 12 };

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
    <div
      className={className}
      role="img"
      aria-label="Bar chart of transactions per day, split into confirmed from SMS, awaiting verification and verification failed."
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={TICK}
            axisLine={{ stroke: GRID }}
            tickLine={false}
          />
          <YAxis
            tick={TICK}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "var(--zp-elevated)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--zp-line)",
              background: "var(--zp-surface)",
              color: "var(--zp-fg)",
              boxShadow: "var(--shadow-overlay)",
              fontSize: 13,
            }}
            labelStyle={{ color: "var(--zp-fg-secondary)", fontWeight: 600 }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={32}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "var(--zp-fg-secondary)" }}
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
