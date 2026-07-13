"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Bell,
  VolumeX,
  Plus,
  Trash2,
  Save,
  Clock,
  CheckCircle,
  AlertTriangle,
  History,
  Settings,
  ShieldCheck,
  Loader2,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../../contexts/AuthContext";
import { auth } from "../../../lib/firebase";
import { useRouter } from "next/navigation";

interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

interface SymbolConfig {
  rsiEnabled: boolean;
  macdEnabled: boolean;
  srFlipEnabled: boolean;
  supportEnabled: boolean;
}

interface AlertLog {
  id: string;
  symbol: string;
  priceAtTrigger: number;
  triggeredMessages: string[];
  sentAt: number;
  outcome1h?: { price: number; changePercent: number; result: string } | null;
  outcome24h?: { price: number; changePercent: number; result: string } | null;
  status: "Pending" | "Completed";
}

export default function AlertCenterPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();

  // Settings State
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [cooldownMinutes, setCooldownMinutes] = useState(120);
  const [quietHours, setQuietHours] = useState<QuietHours>({ enabled: false, start: "22:00", end: "06:00" });
  const [configs, setConfigs] = useState<Record<string, SymbolConfig>>({});

  // History logs state
  const [historyLogs, setHistoryLogs] = useState<AlertLog[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSymbolInput, setNewSymbolInput] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const getSafeIdToken = async (forceRefresh = false): Promise<string | null> => {
    if (typeof getIdToken === "function") {
      try {
        const t = await getIdToken(forceRefresh);
        if (typeof t === "string" && t.length > 0) return t;
      } catch (e) {}
    }
    const currentUser = auth?.currentUser || user;
    if (currentUser && typeof currentUser.getIdToken === "function") {
      try {
        const t = await currentUser.getIdToken(forceRefresh);
        if (typeof t === "string" && t.length > 0) return t;
      } catch (e) {}
    }
    return null;
  };

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  // Load Settings and History Logs
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        const token = await getSafeIdToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // 1. Fetch settings
        const settingsRes = await axios.get("/api/telegram/settings", { headers });
        if (settingsRes.data?.success) {
          const alertSettings = settingsRes.data.alertSettings || {};
          setGlobalEnabled(alertSettings.enabled !== false);
          setSymbols(alertSettings.symbols || []);
          setCooldownMinutes(alertSettings.cooldownMinutes || 120);
          setQuietHours(alertSettings.quietHours || { enabled: false, start: "22:00", end: "06:00" });
          setConfigs(alertSettings.configs || {});
        }

        // 2. Fetch history logs
        const historyRes = await axios.get("/api/telegram/history", { headers });
        if (historyRes.data?.success) {
          setHistoryLogs(historyRes.data.logs || []);
        }
      } catch (err: any) {
        console.error("Failed to load Alert Center data:", err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Save Settings logic
  const handleSaveSettings = async () => {
    if (!user) return;
    setSaving(true);
    setStatusMsg(null);

    try {
      const token = await getSafeIdToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const alertSettings = {
        enabled: globalEnabled,
        symbols,
        cooldownMinutes,
        quietHours,
        configs
      };

      const res = await axios.post("/api/telegram/settings", { alertSettings }, { headers });
      if (res.data?.success) {
        setStatusMsg({ type: "success", text: "บันทึกการตั้งค่าระบบแจ้งเตือนสำเร็จ" });
      } else {
        setStatusMsg({ type: "error", text: res.data?.message || "บันทึกการตั้งค่าล้มเหลว" });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  // Add new symbol configuration helper
  const handleAddSymbol = () => {
    const cleanSym = newSymbolInput.trim().toUpperCase();
    if (!cleanSym) return;

    if (symbols.includes(cleanSym)) {
      setStatusMsg({ type: "error", text: "มีสัญลักษณ์นี้ในระบบเรียบร้อยแล้ว" });
      return;
    }

    setSymbols([...symbols, cleanSym]);
    setConfigs({
      ...configs,
      [cleanSym]: {
        rsiEnabled: true,
        macdEnabled: true,
        srFlipEnabled: true,
        supportEnabled: true
      }
    });
    setNewSymbolInput("");
    setStatusMsg(null);
  };

  // Remove symbol configuration helper
  const handleRemoveSymbol = (sym: string) => {
    setSymbols(symbols.filter(s => s !== sym));
    const nextConfigs = { ...configs };
    delete nextConfigs[sym];
    setConfigs(nextConfigs);
  };

  // Toggle single property per symbol config
  const toggleSymbolConfig = (sym: string, key: keyof SymbolConfig) => {
    const currentSymbolConfig = configs[sym] || {
      rsiEnabled: true,
      macdEnabled: true,
      srFlipEnabled: true,
      supportEnabled: true
    };

    setConfigs({
      ...configs,
      [sym]: {
        ...currentSymbolConfig,
        [key]: !currentSymbolConfig[key]
      }
    });
  };

  // Format date helper (Thai locale format)
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#090d16] text-slate-200">
        <Loader2 className="animate-spin text-indigo-400 mb-4" size={48} />
        <p className="text-sm text-slate-400">กำลังโหลดแผงควบคุมแจ้งเตือน...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#090d16] text-slate-200 p-4 lg:p-6 pb-24">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-100 flex items-center gap-2.5 tracking-tight">
            <Bell className="text-indigo-400 animate-pulse" size={26} />
            Alert Center (ศูนย์ควบคุมการแจ้งเตือน)
          </h1>
          <p className="text-xs lg:text-sm text-slate-400 mt-1">
            รวมการตั้งค่าและประวัติการส่งสัญญาณเทคนิคัลส่งตรงเข้า Telegram ในช่องทางเดียวกัน
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] cursor-pointer"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          บันทึกการตั้งค่า
        </button>
      </header>

      {/* Alert Banner */}
      {statusMsg && (
        <div
          className={`mb-6 p-4 rounded-xl border flex items-center gap-3 text-sm ${
            statusMsg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          {statusMsg.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Columns (Settings & Configs) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Global Alert Switcher & Quiet Hours */}
          <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 lg:p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-6 border-b border-slate-800/80 pb-5">
              {/* Global Enable */}
              <div>
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Settings size={16} className="text-slate-400" />
                  สวิตช์ระบบแจ้งเตือนหลัก
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  เปิดใช้งานการแจ้งเตือนเงื่อนไขไปยังบัญชี Telegram
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => setGlobalEnabled(!globalEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      globalEnabled ? "bg-indigo-600" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        globalEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className={`text-sm font-semibold ${globalEnabled ? "text-indigo-400" : "text-slate-500"}`}>
                    {globalEnabled ? "เปิดใช้งานระบบแจ้งเตือน" : "ปิดใช้งานระบบแจ้งเตือน"}
                  </span>
                </div>
              </div>

              {/* Cooldown Time */}
              <div className="md:w-64">
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  ระยะห่างการแจ้งเตือนซ้ำ (Cooldown)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  ป้องกันการแจ้งเตือนสัญญาณเดิมบ่อยเกินไป
                </p>
                <select
                  value={cooldownMinutes}
                  onChange={(e) => setCooldownMinutes(parseInt(e.target.value))}
                  className="w-full mt-3 bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
                >
                  <option value={15}>15 นาที</option>
                  <option value={30}>30 นาที</option>
                  <option value={60}>1 ชั่วโมง (60 นาที)</option>
                  <option value={120}>2 ชั่วโมง (120 นาที)</option>
                  <option value={240}>4 ชั่วโมง (240 นาที)</option>
                  <option value={720}>12 ชั่วโมง (720 นาที)</option>
                </select>
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <VolumeX size={16} className="text-indigo-400" />
                  ช่วงเวลาห้ามรบกวน (Quiet Hours)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  บล็อกการส่งแจ้งเตือนชั่วคราวในช่วงเวลาค่ำคืนหรือเวลาที่กำหนด (อ้างอิงเวลาไทย GMT+7)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuietHours({ ...quietHours, enabled: !quietHours.enabled })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    quietHours.enabled ? "bg-indigo-600" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      quietHours.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className={`text-sm font-semibold ${quietHours.enabled ? "text-indigo-400" : "text-slate-500"}`}>
                  {quietHours.enabled ? "เปิดโหมดห้ามรบกวน" : "ปิดโหมดห้ามรบกวน"}
                </span>
              </div>

              {quietHours.enabled && (
                <div className="grid grid-cols-2 gap-4 max-w-sm p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5 uppercase font-bold">เวลาเริ่มต้น</label>
                    <input
                      type="time"
                      value={quietHours.start}
                      onChange={(e) => setQuietHours({ ...quietHours, start: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500/50 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5 uppercase font-bold">เวลาสิ้นสุด</label>
                    <input
                      type="time"
                      value={quietHours.end}
                      onChange={(e) => setQuietHours({ ...quietHours, end: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500/50 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Symbol Specific Configuration */}
          <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 lg:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={16} className="text-indigo-400" />
                  เงื่อนไขการแจ้งเตือนรายสัญลักษณ์
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  ปรับตั้งค่าการตรวจจับและกรองเงื่อนไขสัญญาณแยกอิสระต่อสัญลักษณ์
                </p>
              </div>

              {/* Add Symbol Input */}
              <div className="flex gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="สัญลักษณ์ เช่น ETH-USD"
                  value={newSymbolInput}
                  onChange={(e) => setNewSymbolInput(e.target.value)}
                  className="bg-slate-950 border border-slate-800 focus:border-indigo-500/50 text-slate-200 text-sm rounded-xl px-4 py-2 focus:outline-none w-full sm:w-48 uppercase"
                />
                <button
                  onClick={handleAddSymbol}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus size={16} />
                  เพิ่ม
                </button>
              </div>
            </div>

            {/* Configs Table */}
            {symbols.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
                ไม่มีสัญลักษณ์ที่ลงทะเบียนแจ้งเตือนไว้ ป้อนสัญลักษณ์และกดเพิ่มด้านบน
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase font-bold tracking-wider">
                      <th className="py-3 px-4">สัญลักษณ์</th>
                      <th className="py-3 px-4 text-center">RSI Oversold/bought</th>
                      <th className="py-3 px-4 text-center">MACD Crossover</th>
                      <th className="py-3 px-4 text-center">S/R Flip Zone</th>
                      <th className="py-3 px-4 text-center">แนวรับใกล้เคียง</th>
                      <th className="py-3 px-4 text-right">การกระทำ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {symbols.map((sym) => {
                      const cfg = configs[sym] || {
                        rsiEnabled: true,
                        macdEnabled: true,
                        srFlipEnabled: true,
                        supportEnabled: true
                      };

                      return (
                        <tr key={sym} className="border-b border-slate-800/40 hover:bg-slate-800/10 text-sm">
                          <td className="py-3.5 px-4 font-bold text-slate-200 tracking-tight">{sym}</td>
                          
                          {/* RSI */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => toggleSymbolConfig(sym, "rsiEnabled")}
                              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                                cfg.rsiEnabled
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-slate-800 text-slate-500 border-transparent"
                              }`}
                            >
                              {cfg.rsiEnabled ? "เปิด" : "ปิด"}
                            </button>
                          </td>

                          {/* MACD */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => toggleSymbolConfig(sym, "macdEnabled")}
                              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                                cfg.macdEnabled
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-slate-800 text-slate-500 border-transparent"
                              }`}
                            >
                              {cfg.macdEnabled ? "เปิด" : "ปิด"}
                            </button>
                          </td>

                          {/* S/R Flip */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => toggleSymbolConfig(sym, "srFlipEnabled")}
                              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                                cfg.srFlipEnabled
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-slate-800 text-slate-500 border-transparent"
                              }`}
                            >
                              {cfg.srFlipEnabled ? "เปิด" : "ปิด"}
                            </button>
                          </td>

                          {/* Proximity */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => toggleSymbolConfig(sym, "supportEnabled")}
                              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                                cfg.supportEnabled
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-slate-800 text-slate-500 border-transparent"
                              }`}
                            >
                              {cfg.supportEnabled ? "เปิด" : "ปิด"}
                            </button>
                          </td>

                          {/* Delete */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleRemoveSymbol(sym)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Alert History Logs) */}
        <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 lg:p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <History size={16} className="text-indigo-400" />
              ประวัติการส่งสัญญาณแจ้งเตือน
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              ดูประวัติสัญญาณแจ้งเตือนล่าสุดและการประเมินประสิทธิภาพราคาหลังแจ้งเตือน
            </p>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {historyLogs.length === 0 ? (
              <div className="text-center py-10 text-slate-600 text-sm">
                ยังไม่มีประวัติการส่งแจ้งเตือนบันทึกไว้
              </div>
            ) : (
              historyLogs.map((log) => {
                const badgeColor = log.symbol.endsWith("-USD") ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20";
                
                return (
                  <div key={log.id} className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-3 hover:border-slate-700/80 transition-all text-xs">
                    <div className="flex justify-between items-start">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badgeColor}`}>
                        {log.symbol}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {formatDate(log.sentAt)}
                      </span>
                    </div>

                    <div className="text-slate-300 leading-relaxed font-semibold">
                      {log.triggeredMessages.map((msg, i) => (
                        <div key={i} className="flex items-start gap-1.5 mt-1">
                          <span>•</span>
                          <span>{msg}</span>
                        </div>
                      ))}
                    </div>

                    <div className="text-[10px] text-slate-500 flex justify-between border-t border-slate-800/50 pt-2.5">
                      <span>ราคาแจ้งเตือน: ${log.priceAtTrigger.toLocaleString()}</span>
                    </div>

                    {/* Performance Outcomes */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900/60 text-[10px]">
                      {/* 1h Outcome */}
                      <div className="p-2 bg-slate-900/50 rounded-lg">
                        <div className="text-slate-500 font-bold uppercase tracking-wider mb-1">ผลหลัง 1 ชม.</div>
                        {log.outcome1h ? (
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-300">${log.outcome1h.price.toLocaleString()}</span>
                            <span className={`font-semibold flex items-center ${log.outcome1h.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {log.outcome1h.changePercent >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {log.outcome1h.changePercent >= 0 ? "+" : ""}{log.outcome1h.changePercent.toFixed(2)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 animate-pulse">กำลังรอสแกนผล...</span>
                        )}
                      </div>

                      {/* 24h Outcome */}
                      <div className="p-2 bg-slate-900/50 rounded-lg">
                        <div className="text-slate-500 font-bold uppercase tracking-wider mb-1">ผลหลัง 24 ชม.</div>
                        {log.outcome24h ? (
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-300">${log.outcome24h.price.toLocaleString()}</span>
                            <span className={`font-semibold flex items-center ${log.outcome24h.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {log.outcome24h.changePercent >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {log.outcome24h.changePercent >= 0 ? "+" : ""}{log.outcome24h.changePercent.toFixed(2)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 animate-pulse">กำลังรอสแกนผล...</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
