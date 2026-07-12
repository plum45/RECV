"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, BarChart2, Briefcase, Settings, Menu, X, Rocket, Zap, Sun, Moon } from "lucide-react";
import MobileNavBar from "../../components/MobileNavBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("rocket_theme") || "dark";
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(savedTheme);
      return savedTheme;
    }
    return "dark";
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("rocket_theme", nextTheme);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(nextTheme);
    }
  };

  const navItems = [
    { name: "หน้าแรก (Home)", path: "/dashboard", icon: Home },
    { name: "ค้นหาหุ้น (Invest)", path: "/dashboard/invest", icon: Search },
    { name: "วิเคราะห์ (Analyze)", path: "/dashboard/analyze", icon: BarChart2 },
    { name: "สแกนสัญญาณ (Scanner)", path: "/dashboard/scanner", icon: Zap },
    { name: "พอร์ต (Portfolio)", path: "/dashboard/analyze?tab=portfolio", icon: Briefcase },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      
      {/* Mobile Header / Hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 z-[60] flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-indigo-400 font-bold">
          <Rocket size={18} /> iVES
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} className="p-2 text-slate-400 hover:text-white transition-colors">
            {theme === "dark" ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-500" />}
          </button>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400 hover:text-white">
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-[65] backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed lg:static top-0 left-0 h-full w-64 bg-slate-900 border-r border-slate-800/60 z-[70] flex flex-col transition-transform duration-300
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="h-14 lg:h-20 flex items-center justify-between px-6 border-b border-slate-800/60 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 text-xl font-black text-white hover:text-indigo-400 transition-colors">
            <Rocket size={24} className="text-indigo-500" />
            iVES
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = pathname === item.path || (item.path === "/dashboard/analyze?tab=portfolio" && pathname === "/dashboard/analyze" && typeof window !== "undefined" && window.location.search.includes("tab=portfolio"));
            
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  isActive 
                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
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
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative h-full">
          {children}
        </main>
        
        {/* Render MobileNavBar only on small screens */}
        {isMobile && <MobileNavBar activeTab={pathname.split("/").pop() || "home"} setActiveTab={() => {}} />}
      </div>

    </div>
  );
}
