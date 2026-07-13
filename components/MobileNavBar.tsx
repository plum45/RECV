import React, { useEffect, useState } from "react";
import { Home, Star, LayoutGrid, SlidersHorizontal, Briefcase, Bell } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface MobileNavBarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export default function MobileNavBar({ setActiveTab }: MobileNavBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    { id: "home", label: "หน้าแรก", icon: Home, path: "/dashboard" },
    { id: "alerts", label: "แจ้งเตือน", icon: Bell, path: "/dashboard/alerts" },
    { id: "invest", label: "ค้นหาหุ้น", icon: LayoutGrid, isCenter: true, path: "/dashboard/invest" },
    { id: "tools", label: "เครื่องมือ", icon: SlidersHorizontal, path: "/dashboard/scanner" },
    { id: "portfolio", label: "พอร์ต", icon: Briefcase, path: "/dashboard/analyze?tab=portfolio" },
  ];

  const getIsActive = (item: typeof navItems[0]) => {
    const tabParam = searchParams.get("tab");
    if (item.id === "portfolio") {
      return pathname === "/dashboard/analyze" && tabParam === "portfolio";
    }
    if (item.id === "tools") {
      return pathname === "/dashboard/scanner";
    }
    if (item.id === "invest") {
      return pathname === "/dashboard/invest";
    }
    if (item.id === "alerts") {
      return pathname === "/dashboard/alerts";
    }
    if (item.id === "home") {
      return pathname === "/dashboard" && currentHash !== "#watchlist" && !tabParam;
    }
    return false;
  };

  const handleNav = (item: typeof navItems[0]) => {
    if (setActiveTab) {
      setActiveTab(item.id);
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
    <div className="fixed bottom-0 left-0 right-0 w-full bg-white/95 dark:bg-[#12151f]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/50 pb-2 pt-1.5 px-3 min-[380px]:px-6 flex justify-around items-center z-50 rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = getIsActive(item);

        if (item.isCenter) {
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              className="relative flex flex-col items-center justify-center -translate-y-2 cursor-pointer"
            >
              <div className={`w-9 h-9 min-[380px]:w-10 min-[380px]:h-10 rounded-xl flex items-center justify-center shadow-md transition-all duration-300 ${
                isActive 
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm scale-105" 
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:scale-105 border border-transparent dark:border-slate-700/50"
              }`}>
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[8.5px] mt-1 font-bold tracking-tight ${isActive ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>
                {item.label}
              </span>
            </button>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => handleNav(item)}
            className={`flex flex-col items-center gap-1 pb-1 pt-0.5 transition-colors cursor-pointer ${
              isActive ? "text-slate-900 dark:text-white font-black" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium"
            }`}
          >
            <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[8px] tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

