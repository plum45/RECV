"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Home, Search, BarChart2, Briefcase, Menu, X, Rocket, Zap, Sun, Moon, Bell, ShieldAlert, Sliders, Calendar, Gem } from "lucide-react";
import { useTheme } from "next-themes";
import MobileNavBar from "../../components/MobileNavBar";
import { useAuth } from "../../contexts/AuthContext";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const theme = resolvedTheme || "dark";

  useEffect(() => {
    if (!authLoading && !user) {
      if (pathname === "/dashboard/analyze") {
        const query = searchParams.toString();
        router.replace(`/public/analyze${query ? `?${query}` : ""}`);
      } else {
        router.replace("/auth/login");
      }
    }
  }, [authLoading, user, router, pathname, searchParams]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  const navItems = [
    { name: "หน้าแรก (Home)", path: "/dashboard", icon: Home },
    { name: "ค้นหาหุ้น (Invest)", path: "/dashboard/invest", icon: Search },
    { name: "วิเคราะห์ (Analyze)", path: "/dashboard/analyze", icon: BarChart2 },
    { name: "ทองและเงิน (Metals)", path: "/dashboard/metals", icon: Gem },
    { name: "ปฏิทินข่าว (Calendar)", path: "/dashboard/calendar", icon: Calendar },
    { name: "สแกนสัญญาณ (Scanner)", path: "/dashboard/scanner", icon: Zap },
    { name: "พอร์ต (Portfolio)", path: "/dashboard/analyze?tab=portfolio", icon: Briefcase },
    { name: "แผนการเทรด (Trading Plan)", path: "/dashboard/plan", icon: Sliders },
    { name: "คำนวณความเสี่ยง (Risk)", path: "/dashboard/risk", icon: ShieldAlert },
    { name: "แจ้งเตือน (Alerts)", path: "/dashboard/alerts", icon: Bell },
  ];

  if (authLoading || !user) {
    return (
      <div className="dashboard-canvas flex h-screen items-center justify-center text-slate-100">
        <div className="h-10 w-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="dashboard-canvas flex h-screen overflow-hidden text-slate-100">
      
      {/* Mobile Header / Hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 z-[60] flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-white font-black text-lg tracking-tight">
          <Rocket size={18} className="text-slate-200" /> iVES
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer" aria-label="สลับโหมดการแสดงผล">
            {theme === "dark" ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-300" />}
          </button>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400 hover:text-white cursor-pointer" aria-label="เปิดเมนูทางเลือก">
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/70 z-[65] backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed lg:static top-0 left-0 h-full w-64 bg-slate-950/95 backdrop-blur-2xl border-r border-slate-800/80 z-[70] flex flex-col transition-transform duration-300
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="h-14 lg:h-20 flex items-center justify-between px-6 border-b border-slate-800/80 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 text-xl font-black text-white hover:text-slate-300 transition-colors">
            <Rocket size={24} className="text-slate-200" />
            iVES
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white cursor-pointer" aria-label="ปิดเมนูทางเลือก">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const [itemPath, itemQuery] = item.path.split("?");
            const isPortfolio = itemQuery === "tab=portfolio";
            const isActive = pathname === itemPath && (isPortfolio
              ? searchParams.get("tab") === "portfolio"
              : searchParams.get("tab") !== "portfolio");
            
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
                  isActive 
                    ? "bg-slate-850 bg-slate-900 text-white border border-slate-700/80 shadow-md font-bold"
                    : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
                }`}
              >
                <item.icon size={18} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Theme Toggle (Sidebar Footer) */}
        <div className="p-4 border-t border-slate-800/60 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">โหมดการแสดงผล</span>
          <button
            onClick={toggleTheme}
            className="p-1.5 px-2.5 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white transition-all hover:bg-slate-800 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          >
            {theme === "dark" ? (
              <>
                <Sun size={14} className="text-amber-400" />
                สว่าง
              </>
            ) : (
              <>
                <Moon size={14} className="text-indigo-400" />
                มืด
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative w-full lg:w-[calc(100%-16rem)] lg:pt-0">
        <div className="lg:hidden h-14 shrink-0" /> {/* Mobile header spacer */}
        
        {/* Child Pages are rendered here */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative h-full pb-24 lg:pb-6">
          {children}
        </main>
        
        {/* Render MobileNavBar only on small screens */}
        <div className="lg:hidden">
          <MobileNavBar activeTab={pathname.split("/").pop() || "home"} setActiveTab={() => {}} />
        </div>
      </div>

    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense
      fallback={
        <div className="dashboard-canvas flex h-screen items-center justify-center text-slate-100">
          <div className="h-10 w-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <DashboardShell>{children}</DashboardShell>
    </React.Suspense>
  );
}
