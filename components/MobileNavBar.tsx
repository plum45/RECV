"use client";

import React, { useEffect, useState } from "react";
import { Home, Star, LayoutGrid, SlidersHorizontal, Briefcase } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

interface MobileNavBarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export default function MobileNavBar({ setActiveTab }: MobileNavBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [currentHash, setCurrentHash] = useState(() =>
    typeof window !== "undefined" ? window.location.hash : ""
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleHashChange = () => setCurrentHash(window.location.hash);
      window.addEventListener("hashchange", handleHashChange);
      return () => window.removeEventListener("hashchange", handleHashChange);
    }
  }, [pathname]);

  const navItems = [
    { id: "home", label: "หน้าแรก", icon: Home, path: "/dashboard", ariaLabel: "ไปที่หน้าแรก" },
    { id: "watchlist", label: "หุ้นโปรด", icon: Star, path: "/dashboard#watchlist", ariaLabel: "ไปที่รายการหุ้นโปรด" },
    { id: "invest", label: "วิเคราะห์", icon: LayoutGrid, isCenter: true, path: "/dashboard/analyze", ariaLabel: "ไปที่หน้าวิเคราะห์หุ้น" },
    { id: "tools", label: "Scanner", icon: SlidersHorizontal, path: "/dashboard/scanner", ariaLabel: "ไปที่หน้าสแกนสัญญาณ" },
    { id: "portfolio", label: "พอร์ต", icon: Briefcase, path: "/dashboard/portfolio", ariaLabel: "ไปที่หน้าพอร์ตจำลอง" },
  ];

  const getIsActive = (item: typeof navItems[0]) => {
    if (item.id === "portfolio") {
      return pathname === "/dashboard/portfolio";
    }
    if (item.id === "tools") {
      return pathname === "/dashboard/scanner";
    }
    if (item.id === "invest") {
      return pathname === "/dashboard/analyze";
    }
    if (item.id === "watchlist") {
      return pathname === "/dashboard" && currentHash === "#watchlist";
    }
    if (item.id === "home") {
      return pathname === "/dashboard" && currentHash !== "#watchlist";
    }
    return false;
  };

  const handleNav = (item: typeof navItems[0]) => {
    if (setActiveTab) {
      setActiveTab(item.id);
    }
    
    if (item.id === "watchlist") {
      if (pathname === "/dashboard") {
        setCurrentHash("#watchlist");
        window.location.hash = "watchlist";
        const el = document.getElementById("watchlist");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }
    }
    
    if (item.id === "home" && pathname === "/dashboard") {
      setCurrentHash("");
      window.history.pushState("", "", "/dashboard");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    
    router.push(item.path);
  };

  return (
    <nav 
      aria-label="เมนูหลักบนมือถือ"
      className="fixed bottom-0 left-0 right-0 w-full bg-white/95 dark:bg-[#12151f]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/50 pb-4 pt-2.5 px-4 flex justify-around items-center z-50 rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = getIsActive(item);

        if (item.isCenter) {
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              aria-label={item.ariaLabel}
              className="relative flex flex-col items-center justify-center -translate-y-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl px-2.5 py-1"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-md transition-all duration-300 ${
                isActive 
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm scale-105" 
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:scale-105 border border-transparent dark:border-slate-700/50"
              }`}>
                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[9.5px] mt-1 font-bold tracking-tight ${isActive ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>
                {item.label}
              </span>
            </button>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => handleNav(item)}
            aria-label={item.ariaLabel}
            className={`flex flex-col items-center gap-1.5 pb-1 pt-1.5 px-3 rounded-xl transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isActive 
                ? "text-slate-900 dark:text-white font-black" 
                : "text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-350 font-medium"
            }`}
          >
            <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[9.5px] tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
