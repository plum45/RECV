import React from "react";
import { Home, Star, LayoutGrid, SlidersHorizontal, Briefcase } from "lucide-react";

interface MobileNavBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function MobileNavBar({ activeTab, setActiveTab }: MobileNavBarProps) {
  const navItems = [
    { id: "home", label: "หน้าแรก", icon: Home },
    { id: "favorites", label: "หุ้นโปรด", icon: Star },
    { id: "scan", label: "สแกน", icon: LayoutGrid, isCenter: true },
    { id: "tools", label: "เครื่องมือ", icon: SlidersHorizontal },
    { id: "portfolio", label: "พอร์ต", icon: Briefcase },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-[#12151f] border-t border-slate-200 dark:border-slate-800/50 pb-safe pt-2 px-6 flex justify-between items-end z-50 rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        if (item.isCenter) {
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="relative flex flex-col items-center justify-center -translate-y-4"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 ${
                isActive 
                  ? "bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-indigo-500/40" 
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}>
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] mt-1.5 font-bold ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"}`}>
                {item.label}
              </span>
            </button>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1.5 pb-2 transition-colors ${
              isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[9px] font-bold">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
