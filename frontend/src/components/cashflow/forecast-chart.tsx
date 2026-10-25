"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import type { Forecast } from "@/lib/cashflow";
export default function ForecastChart({ forecast }: { forecast: Forecast }) {
  const history = forecast.base.history
    .filter((d) => d.cash !== null)
    .map((d) => ({
      date: d.date,
      actual: Number(d.cash),
      base: undefined as number | undefined,
      scenario: undefined as number | undefined,
    }));
  const data = [
    ...history.filter((d) => d.date < forecast.base.as_of),
    ...forecast.base.days.map((d, i) => ({
      date: d.date,
      actual: i === 0 ? Number(d.cash) : undefined,
      base: Number(d.cash),
      scenario: forecast.scenario?.days[i]
        ? Number(forecast.scenario.days[i].cash)
        : undefined,
    })),
  ];
  const format = (n: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: forecast.currency,
      maximumFractionDigits: 0,
    }).format(n);
  if (!data.length)
    return <p>Add reviewed opening balances to see dated cash.</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={data}
        margin={{ left: 14, right: 14, top: 12, bottom: 8 }}
      >
        <CartesianGrid stroke="#2b3337" strokeDasharray="3 5" />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => String(d).slice(5)}
          stroke="#b5bbb9"
          minTickGap={38}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          stroke="#b5bbb9"
          tickFormatter={(n) => format(n)}
          width={90}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(v: number) =>
            new Intl.NumberFormat("en", {
              style: "currency",
              currency: forecast.currency,
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(v)
          }
          contentStyle={{
            background: "#14181d",
            border: "1px solid #3a4449",
            color: "#ede7dc",
          }}
        />
        <Legend />
        <ReferenceLine
          y={Number(forecast.base.buffer)}
          stroke="#e8913c"
          strokeDasharray="4 5"
          label={{
            value: "Buffer",
            fill: "#e8913c",
            position: "insideTopRight",
          }}
        />
        <ReferenceLine
          x={forecast.base.as_of}
          stroke="#b5bbb9"
          label={{ value: "As of", fill: "#b5bbb9", position: "insideTopLeft" }}
        />
        {Number(forecast.base.reserved_cash) > 0 && (
          <ReferenceLine
            y={
              Number(forecast.base.buffer) + Number(forecast.base.reserved_cash)
            }
            stroke="#bc9470"
            strokeDasharray="2 4"
            label={{
              value: "Buffer + goals",
              fill: "#bc9470",
              position: "insideTopRight",
            }}
          />
        )}
        <Line
          isAnimationActive={false}
          type="stepAfter"
          dataKey="actual"
          name="Recorded cash"
          stroke="#8eb9aa"
          strokeWidth={2}
          dot={false}
        />
        <ReferenceLine y={0} stroke="#d78179" />
        <Line
          isAnimationActive={false}
          type="stepAfter"
          dataKey="base"
          name="Base plan · end of day"
          stroke="#8eb9aa"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={false}
        />
        {forecast.scenario && (
          <Line
            isAnimationActive={false}
            type="stepAfter"
            dataKey="scenario"
            name="Scenario · end of day"
            stroke="#e8913c"
            strokeWidth={2}
            strokeDasharray="2 3"
            dot={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
