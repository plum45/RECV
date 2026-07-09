/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Trash2, Wallet, TrendingUp, TrendingDown, RefreshCw, AlertCircle, PieChart as PieIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface Holding {
  id: string;
  symbol: string;
  qty: number;
  buyPrice: number;
  currentPrice?: number;
}

const symbols = [
  { value: "NVDA", label: "NVIDIA (NVDA)" },
  { value: "TSLA", label: "Tesla (TSLA)" },
  { value: "AAPL", label: "Apple (AAPL)" },
  { value: "PLTR", label: "Palantir (PLTR)" },
  { value: "MSFT", label: "Microsoft (MSFT)" },
  { value: "AMD", label: "AMD (AMD)" },
  { value: "AMZN", label: "Amazon (AMZN)" },
  { value: "META", label: "Meta (META)" },
];

const COLORS = ["#6366f1", "#a855f7", "#ec4899", "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#14b8a6"];

export default function PortfolioView() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [symbol, setSymbol] = useState("NVDA");
  const [qty, setQty] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load portfolio from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("rocket_portfolio");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setHoldings(parsed);
      } catch (e) {
        console.error("Failed to parse portfolio", e);
      }
    }
  }, []);

  // Save portfolio to localStorage
  const savePortfolio = (newHoldings: Holding[]) => {
    localStorage.setItem("rocket_portfolio", JSON.stringify(newHoldings));
    setHoldings(newHoldings);
  };

  // Fetch current prices from Yahoo Finance for all holdings
  const updatePrices = async (currentHoldings = holdings) => {
    if (currentHoldings.length === 0) return;
    try {
      setUpdating(true);
      setError(null);

      const updated = await Promise.all(
        currentHoldings.map(async (holding) => {
          try {
            const res = await axios.get<{ currentPrice: number }>(`/api/ticker?symbol=${holding.symbol}`);
            return {
              ...holding,
              currentPrice: res.data.currentPrice,
            };
          } catch (err) {
            console.warn(`Failed to update price for ${holding.symbol}`, err);
            return holding;
          }
        })
      );

      savePortfolio(updated);
    } catch (err: any) {
      setError("ไม่สามารถดึงข้อมูลราคาตลาดล่าสุดของหุ้นในพอร์ตได้");
    } finally {
      setUpdating(false);
    }
  };

  // Run update on load or when holdings count changes
  useEffect(() => {
    if (holdings.length > 0 && holdings.every((h) => h.currentPrice === undefined)) {
      updatePrices(holdings);
    }
  }, [holdings]);

  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qty || !buyPrice || parseFloat(qty) <= 0 || parseFloat(buyPrice) <= 0) {
      setError("กรุณากรอกปริมาณและราคาเฉลี่ยที่ถูกต้อง");
      return;
    }

    const newHolding: Holding = {
      id: Math.random().toString(36).substring(2, 9),
      symbol,
      qty: parseFloat(qty),
      buyPrice: parseFloat(buyPrice),
    };

    const newHoldings = [...holdings, newHolding];
    savePortfolio(newHoldings);
    setQty("");
    setBuyPrice("");
    updatePrices(newHoldings);
  };

  const handleDeleteHolding = (id: string) => {
    const filtered = holdings.filter((h) => h.id !== id);
    savePortfolio(filtered);
  };

  // Portfolio calculations
  let totalCost = 0;
  let totalValue = 0;
  holdings.forEach((h) => {
    const current = h.currentPrice || h.buyPrice;
    totalCost += h.qty * h.buyPrice;
    totalValue += h.qty * current;
  });

  const totalPnLVal = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnLVal / totalCost) * 100 : 0;
  const isProfit = totalPnLVal >= 0;

  // Pie chart data
  const chartData = holdings.map((h) => {
    const value = h.qty * (h.currentPrice || h.buyPrice);
    return {
      name: h.symbol,
      value: parseFloat(value.toFixed(2)),
    };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT COLUMN: Summary & Holdings Table (col-span-8) */}
      <div className="lg:col-span-8 space-y-6">
        {/* Error notice */}
        {error && (
          <div className="bg-rose-950/20 border border-rose-800/30 text-rose-300 text-xs rounded-xl p-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Portfolio Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">มูลค่าพอร์ตโดยรวม (Market Value)</span>
            <span className="text-2xl font-black text-slate-50 mt-1 block">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500 mt-1 block">
              ต้นทุนสุทธิ: ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">กำไร/ขาดทุนสะสม (Total PnL)</span>
            <span className={`text-2xl font-black mt-1 block flex items-center gap-1.5 ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
              {isProfit ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              {isProfit ? "+" : ""}${totalPnLVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-[10px] font-bold mt-1 block ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
              {isProfit ? "+" : ""}{totalPnLPct.toFixed(2)}%
            </span>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">อัปเดตราคาพอร์ตล่าสุด</span>
              <span className="text-xs text-slate-400 mt-2 block font-semibold">
                หุ้นที่ลงทุน: {holdings.length} ตัว
              </span>
            </div>
            <button
              onClick={() => updatePrices()}
              disabled={updating || holdings.length === 0}
              className="mt-3 w-full bg-slate-950 border border-slate-800 hover:border-slate-700 disabled:opacity-50 text-[10px] font-bold uppercase py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer"
            >
              <RefreshCw size={11} className={updating ? "animate-spin" : ""} />
              {updating ? "Updating Prices..." : "Sync Prices"}
            </button>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="bg-slate-900/45 backdrop-blur-md border border-slate-800/60 rounded-2xl shadow-2xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-center mb-4 border-b border-slate-900 pb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
              <Wallet size={14} className="text-indigo-400" />
              สินทรัพย์ที่ถือครองทั้งหมด (Active Holdings)
            </span>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="min-w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">สัญลักษณ์</th>
                  <th className="px-4 py-3 text-right">จำนวนหุ้น</th>
                  <th className="px-4 py-3 text-right">ราคาทุนเฉลี่ย</th>
                  <th className="px-4 py-3 text-right">ราคาล่าสุด</th>
                  <th className="px-4 py-3 text-right">ต้นทุนรวม</th>
                  <th className="px-4 py-3 text-right">มูลค่าปัจจุบัน</th>
                  <th className="px-4 py-3 text-right">PnL (%)</th>
                  <th className="px-4 py-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/20">
                {holdings.map((h) => {
                  const currentPrice = h.currentPrice || h.buyPrice;
                  const cost = h.qty * h.buyPrice;
                  const currentVal = h.qty * currentPrice;
                  const pnlVal = currentVal - cost;
                  const pnlPct = cost > 0 ? (pnlVal / cost) * 100 : 0;
                  const isHoldingProfit = pnlVal >= 0;

                  return (
                    <tr key={h.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-100">{h.symbol}</td>
                      <td className="px-4 py-3.5 text-right font-semibold">{h.qty.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-right">${h.buyPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3.5 text-right text-slate-200">
                        ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-400">${cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-slate-100">${currentVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className={`px-4 py-3.5 text-right font-extrabold ${isHoldingProfit ? "text-emerald-400" : "text-rose-400"}`}>
                        {isHoldingProfit ? "+" : ""}
                        {pnlPct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleDeleteHolding(h.id)}
                          className="p-1.5 bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-800 hover:border-rose-900/50 transition-all cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {holdings.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-500">
                      ยังไม่มีการซื้อขายในพอร์ต จำลองเพิ่มการถือครองด้วยแบบฟอร์มด้านข้าง
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Add Asset & Recharts allocation (col-span-4) */}
      <div className="lg:col-span-4 space-y-6">
        {/* Add Asset Form */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl relative">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <Plus size={14} className="text-indigo-400" />
            จำลองพอร์ตลงทุน (Add Holding)
          </h3>
          <form onSubmit={handleAddHolding} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                เลือกหุ้น
              </label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-100 rounded-xl px-3 py-2.5 outline-none cursor-pointer hover:border-slate-700 focus:border-indigo-500 transition-all"
              >
                {symbols.map((sym) => (
                  <option key={sym.value} value={sym.value}>
                    {sym.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  จำนวนหุ้น (Qty)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="เช่น 10"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 hover:border-slate-700 text-xs text-slate-100 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  ราคาทุน ($)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="เช่น 185.50"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 hover:border-slate-700 text-xs text-slate-100 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-slate-50 text-xs font-bold py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus size={13} />
              เพิ่มเข้าพอร์ตการจำลอง
            </button>
          </form>
        </div>

        {/* Portfolio Allocation Pie Chart */}
        {holdings.length > 0 && (
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl h-[320px] flex flex-col relative">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <PieIcon size={13} className="text-purple-400" />
              การกระจายพอร์ต (Asset Allocation)
            </h3>
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0b0f19", borderColor: "#1e293b", borderRadius: "12px", fontSize: "11px" }}
                    itemStyle={{ color: "#f8fafc" }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "10px", bottom: 0 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
