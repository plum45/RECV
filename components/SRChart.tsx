"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  CartesianGrid,
} from "recharts";
import { IndicatorData, SupportResistanceData, KlineData } from "../types/market";

interface SRChartProps {
  klines: KlineData[] | null;
  indicators: IndicatorData | null;
  supportResistance: SupportResistanceData | null;
  currentPrice: number | null;
}

// Parse "low-high" zone string → midpoint price
function parseZoneMid(zoneStr: string): { low: number; high: number; mid: number } | null {
  try {
    const clean = zoneStr.replace(/,/g, "");
    const parts = clean.split("-");
    if (parts.length === 2) {
      const low = parseFloat(parts[0]);
      const high = parseFloat(parts[1]);
      return { low, high, mid: (low + high) / 2 };
    }
    return null;
  } catch {
    return null;
  }
}

// Custom label for reference lines
const SRLineLabel = ({
  viewBox,
  value,
  color,
  score,
}: {
  viewBox?: any;
  value: string;
  color: string;
  score: number;
}) => {
  const { x = 0, y = 0, width = 0 } = viewBox || {};
  return (
    <g>
      <rect
        x={x + width - 145}
        y={y - 13}
        width={140}
        height={26}
        rx={6}
        fill="#0b0f19"
        fillOpacity={0.95}
        stroke={color}
        strokeOpacity={0.7}
        strokeWidth={1.5}
      />
      <text
        x={x + width - 75}
        y={y + 4}
        textAnchor="middle"
        fill={color}
        fontSize={11}
        fontWeight="extrabold"
        fontFamily="monospace"
      >
        {value} · {score}/10
      </text>
    </g>
  );
};

// Custom label for current price reference line
const CurrentPriceLabel = ({
  viewBox,
  value,
}: {
  viewBox?: any;
  value: string;
}) => {
  const { x = 0, y = 0 } = viewBox || {};
  return (
    <g>
      <rect
        x={x + 10}
        y={y - 13}
        width={160}
        height={26}
        rx={6}
        fill="#4f46e5"
        stroke="#818cf8"
        strokeWidth={1.5}
      />
      <text
        x={x + 90}
        y={y + 4}
        textAnchor="middle"
        fill="#ffffff"
        fontSize={11}
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        ราคาปัจจุบัน: ${value}
      </text>
    </g>
  );
};

// Custom label for Fibonacci reference lines
const FibLineLabel = ({
  viewBox,
  value,
  color = "#64748b",
}: {
  viewBox?: any;
  value: string;
  color?: string;
}) => {
  const { x = 0, y = 0 } = viewBox || {};
  return (
    <g>
      <text
        x={x - 10}
        y={y + 3}
        textAnchor="end"
        fill={color}
        fontSize={9}
        fontWeight="extrabold"
        fontFamily="monospace"
        className="select-none opacity-80"
      >
        {value}
      </text>
    </g>
  );
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const price = payload[0]?.value;
  return (
    <div
      style={{
        background: "#090d16",
        border: "1px solid #334155",
        borderRadius: "10px",
        padding: "10px 14px",
        fontSize: "12px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
      }}
    >
      <div style={{ color: "#94a3b8", marginBottom: 4, fontWeight: "bold" }}>{label}</div>
      <div style={{ color: "#818cf8", fontFamily: "monospace", fontWeight: "bold" }}>
        ราคา: ${price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
};

export default function SRChart({ klines, indicators, supportResistance, currentPrice }: SRChartProps) {
  if (!klines || klines.length === 0 || !indicators) {
    return (
      <div className="w-full h-[420px] sm:h-[520px] lg:h-[600px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-500 shadow-2xl gap-3">
        <div className="text-3xl opacity-30">📊</div>
        <p className="text-sm font-semibold">ไม่มีข้อมูลกราฟเทคนิคอล</p>
        <p className="text-xs text-slate-600">กรุณากด Analyze หรือรอข้อมูลโหลดเสร็จ</p>
      </div>
    );
  }

  // Format chart data — show last 80 candles
  const chartData = useMemo(() =>
    klines.slice(-80).map((k) => {
      const date = new Date(k.openTime);
      const timeStr = date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      const dayStr = date.toLocaleDateString("th-TH", { day: "2-digit", month: "short" });
      return {
        name: `${dayStr} ${timeStr}`,
        price: parseFloat(k.close.toFixed(2)),
      };
    }),
    [klines]
  );

  // Build parsed S/R level lists
  let supportLevels = (supportResistance?.supportZones || [])
    .map((sz, idx) => ({ ...sz, parsed: parseZoneMid(sz.zone), idx }))
    .filter((s) => s.parsed !== null);

  let resistanceLevels = (supportResistance?.resistanceZones || [])
    .map((rz, idx) => ({ ...rz, parsed: parseZoneMid(rz.zone), idx }))
    .filter((r) => r.parsed !== null);

  const priceVal = currentPrice || klines[klines.length - 1]?.close || 100;

  // Guarantee exactly 3 support levels are always displayed on the chart
  if (supportLevels.length > 3) {
    supportLevels = supportLevels.slice(0, 3);
  } else if (supportLevels.length < 3) {
    const gap = priceVal * 0.018; // 1.8% gap so fallback levels are close and visible on the chart
    while (supportLevels.length < 3) {
      const idx = supportLevels.length;
      const fallbackMid = priceVal - (idx + 1) * gap;
      const low = fallbackMid * 0.995;
      const high = fallbackMid * 1.005;
      supportLevels.push({
        zone: `${low.toFixed(2)}-${high.toFixed(2)}`,
        type: "support",
        score: 5,
        reasons: ["แนวรับจำลอง (Projection)"],
        parsed: { mid: fallbackMid, low, high },
        idx
      });
    }
  }

  // Guarantee exactly 3 resistance levels are always displayed on the chart
  if (resistanceLevels.length > 3) {
    resistanceLevels = resistanceLevels.slice(0, 3);
  } else if (resistanceLevels.length < 3) {
    const gap = priceVal * 0.018; // 1.8% gap
    while (resistanceLevels.length < 3) {
      const idx = resistanceLevels.length;
      const fallbackMid = priceVal + (idx + 1) * gap;
      const low = fallbackMid * 0.995;
      const high = fallbackMid * 1.005;
      resistanceLevels.push({
        zone: `${low.toFixed(2)}-${high.toFixed(2)}`,
        type: "resistance",
        score: 5,
        reasons: ["แนวต้านจำลอง (Projection)"],
        parsed: { mid: fallbackMid, low, high },
        idx
      });
    }
  }

  // Y-axis domain (includes close prices and S/R levels to auto-expand viewport)
  const closePrices = klines.slice(-80).map((k) => k.close);
  const supportPrices = supportLevels.map((s) => s.parsed!.mid);
  const resistancePrices = resistanceLevels.map((r) => r.parsed!.mid);
  const allPrices = [...closePrices, ...supportPrices, ...resistancePrices];

  const minClose = Math.min(...allPrices);
  const maxClose = Math.max(...allPrices);
  const padding = (maxClose - minClose) * 0.05;
  const yDomain = [
    parseFloat((minClose - padding).toFixed(2)),
    parseFloat((maxClose + padding).toFixed(2)),
  ];

  return (
    <div className="relative w-full bg-slate-950 border border-slate-800/80 rounded-2xl p-4 shadow-2xl flex flex-col gap-4 overflow-hidden">
      {/* Subtle grid backdrop */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.004)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.004)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-start relative z-10">
        <div>
          <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block">
            Quantitative S/R Chart Overlay
          </span>
          <h4 className="text-sm font-black text-slate-100 uppercase tracking-wide mt-0.5">
            โซนแนวรับ-แนวต้านจำลอง (Support &amp; Resistance Bands)
          </h4>
        </div>
        {currentPrice && (
          <div className="bg-indigo-950/60 border border-indigo-800/50 rounded-xl px-3 py-1.5 font-mono text-xs font-bold text-indigo-300 shadow-inner">
            ราคาล่าสุด:{" "}
            <span className="text-indigo-200 text-sm">
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="w-full h-[300px] md:h-[520px] relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 65, left: 110, bottom: 10 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.12} />
            <XAxis
              dataKey="name"
              stroke="#334155"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              dy={5}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={yDomain}
              stroke="#334155"
              tick={{ fill: "#cbd5e1", fontSize: 11, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={false}
              orientation="right"
              dx={5}
              tickFormatter={(val) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 0 })}`}
              width={65}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* === SUPPORT ZONES (green bands + midline) === */}
            {supportLevels.map((sz) => {
              const p = sz.parsed!;
              const opacity = 0.04 + (sz.score / 10) * 0.06; // stronger zone = more visible
              return (
                <React.Fragment key={`s-${sz.idx}`}>
                  <ReferenceArea
                    y1={p.low}
                    y2={p.high}
                    fill="#10b981"
                    fillOpacity={opacity}
                    stroke="#10b981"
                    strokeOpacity={0.0}
                  />
                  <ReferenceLine
                    y={p.mid}
                    stroke="#10b981"
                    strokeWidth={1.5}
                    strokeDasharray="6 3"
                    strokeOpacity={0.7}
                    label={
                      <SRLineLabel
                        value={`S${sz.idx + 1} $${p.mid.toFixed(2)}`}
                        color="#10b981"
                        score={sz.score}
                      />
                    }
                  />
                </React.Fragment>
              );
            })}

            {/* === RESISTANCE ZONES (red bands + midline) === */}
            {resistanceLevels.map((rz) => {
              const p = rz.parsed!;
              const opacity = 0.04 + (rz.score / 10) * 0.06;
              return (
                <React.Fragment key={`r-${rz.idx}`}>
                  <ReferenceArea
                    y1={p.low}
                    y2={p.high}
                    fill="#f43f5e"
                    fillOpacity={opacity}
                    stroke="#f43f5e"
                    strokeOpacity={0.0}
                  />
                  <ReferenceLine
                    y={p.mid}
                    stroke="#f43f5e"
                    strokeWidth={1.5}
                    strokeDasharray="6 3"
                    strokeOpacity={0.7}
                    label={
                      <SRLineLabel
                        value={`R${rz.idx + 1} $${p.mid.toFixed(2)}`}
                        color="#f43f5e"
                        score={rz.score}
                      />
                    }
                  />
                </React.Fragment>
              );
            })}

            {/* === EMA Lines === */}
            {indicators.ema20 > 0 && (
              <ReferenceLine
                y={indicators.ema20}
                stroke="#f59e0b"
                strokeWidth={1}
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />
            )}
            {indicators.ema50 > 0 && (
              <ReferenceLine
                y={indicators.ema50}
                stroke="#a855f7"
                strokeWidth={1}
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />
            )}

            {/* === Fibonacci Retracement Lines === */}
            {indicators?.fibonacci && (
              <>
                <ReferenceLine
                  y={indicators.fibonacci.r236}
                  stroke="#475569"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  strokeOpacity={0.25}
                  label={<FibLineLabel value={`Fib 23.6% $${indicators.fibonacci.r236.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`} />}
                />
                <ReferenceLine
                  y={indicators.fibonacci.r382}
                  stroke="#475569"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  strokeOpacity={0.25}
                  label={<FibLineLabel value={`Fib 38.2% $${indicators.fibonacci.r382.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`} />}
                />
                <ReferenceLine
                  y={indicators.fibonacci.r500}
                  stroke="#475569"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  strokeOpacity={0.25}
                  label={<FibLineLabel value={`Fib 50.0% $${indicators.fibonacci.r500.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`} />}
                />
                <ReferenceLine
                  y={indicators.fibonacci.r618}
                  stroke="#6366f1"
                  strokeWidth={1.2}
                  strokeDasharray="3 3"
                  strokeOpacity={0.4}
                  label={<FibLineLabel value={`Fib 61.8% (Golden) $${indicators.fibonacci.r618.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`} color="#818cf8" />}
                />
                <ReferenceLine
                  y={indicators.fibonacci.r786}
                  stroke="#475569"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  strokeOpacity={0.25}
                  label={<FibLineLabel value={`Fib 78.6% $${indicators.fibonacci.r786.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`} />}
                />
              </>
            )}

            {/* === Current Price Line === */}
            {currentPrice && (
              <ReferenceLine
                y={currentPrice}
                stroke="#4f46e5"
                strokeWidth={2}
                strokeOpacity={0.95}
                strokeDasharray="5 3"
                label={
                  <CurrentPriceLabel
                    value={currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  />
                }
              />
            )}

            {/* === Price Candle Close Line === */}
            <Area
              type="monotone"
              dataKey="price"
              stroke="#6366f1"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorPrice)"
              baseValue={yDomain[0]}
              dot={false}
              name="ราคาหุ้น (Close)"
              activeDot={{ r: 5, fill: "#818cf8", stroke: "#0f172a", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend + S/R Summary Cards */}
      <div className="relative z-10 border-t border-slate-800/60 pt-3 space-y-3">
        {/* Legend Pills */}
        <div className="flex flex-wrap gap-3 text-[10px] font-bold tracking-wider text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-1 bg-indigo-500 rounded-full" />
            <span>เส้นราคาหุ้น</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-1 bg-emerald-500 rounded-full opacity-70" style={{ border: "1px dashed #10b981" }} />
            <span>แนวรับ (Support)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-1 bg-rose-500 rounded-full opacity-70" style={{ border: "1px dashed #f43f5e" }} />
            <span>แนวต้าน (Resistance)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-1 bg-amber-400 rounded-full opacity-60" />
            <span>EMA 20</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-1 bg-purple-500 rounded-full opacity-60" />
            <span>EMA 50</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-1 bg-slate-500 rounded-full opacity-60" style={{ border: "1px dotted #64748b" }} />
            <span>Fibonacci Levels</span>
          </div>
        </div>

        {/* S/R Detail Cards Row */}
        {(supportLevels.length > 0 || resistanceLevels.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Support Cards */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                📗 แนวรับสำคัญ (Top Support)
              </p>
              {supportLevels.map((sz) => (
                <div
                  key={`sc-${sz.idx}`}
                  className="bg-emerald-950/30 border border-emerald-800/30 rounded-xl px-3 py-2 text-xs"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-black text-emerald-300 font-mono">
                      S{sz.idx + 1}: ${sz.parsed!.mid.toFixed(2)}
                    </span>
                    <span className="bg-emerald-900/50 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-700/40">
                      {sz.score}/10
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    โซน: ${sz.zone}
                  </div>
                  {sz.reasons.length > 0 && (
                    <div className="text-[9px] text-emerald-600 mt-0.5">
                      {sz.reasons[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Resistance Cards */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                📕 แนวต้านสำคัญ (Top Resistance)
              </p>
              {resistanceLevels.map((rz) => (
                <div
                  key={`rc-${rz.idx}`}
                  className="bg-rose-950/30 border border-rose-800/30 rounded-xl px-3 py-2 text-xs"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-black text-rose-300 font-mono">
                      R{rz.idx + 1}: ${rz.parsed!.mid.toFixed(2)}
                    </span>
                    <span className="bg-rose-900/50 text-rose-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-rose-700/40">
                      {rz.score}/10
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    โซน: ${rz.zone}
                  </div>
                  {rz.reasons.length > 0 && (
                    <div className="text-[9px] text-rose-600 mt-0.5">
                      {rz.reasons[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
