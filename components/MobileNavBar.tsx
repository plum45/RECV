import React from "react";
import { Home, Star, LayoutGrid, SlidersHorizontal, Briefcase } from "lucide-react";
import { useRouter } from "next/navigation";

interface MobileNavBarProps {
  activeTab: string;
  setActiveTab?: (tab: string) => void;
}

export default function MobileNavBar({ activeTab, setActiveTab }: MobileNavBarProps) {
  const router = useRouter();

  const navItems = [
    { id: "home", label: "หน้าแรก", icon: Home, path: "/dashboard" },
    { id: "favorites", label: "หุ้นโปรด", icon: Star, path: "/dashboard" },
    { id: "invest", label: "ค้นหาหุ้น", icon: LayoutGrid, isCenter: true, path: "/dashboard/invest" },
    { id: "tools", label: "เครื่องมือ", icon: SlidersHorizontal, path: "/dashboard" },
    { id: "portfolio", label: "พอร์ต", icon: Briefcase, path: "/dashboard?tab=portfolio" },
  ];

  const handleNav = (item: typeof navItems[0]) => {
    if (setActiveTab) {
      setActiveTab(item.id);
    }
    router.push(item.path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 w-full bg-white/95 dark:bg-[#12151f]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/50 pb-2 pt-1.5 px-3 min-[380px]:px-6 flex justify-around items-center z-50 rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        if (item.isCenter) {
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              className="relative flex flex-col items-center justify-center -translate-y-2 cursor-pointer"
            >
              <div className={`w-9 h-9 min-[380px]:w-10 min-[380px]:h-10 rounded-xl flex items-center justify-center shadow-md transition-all duration-300 ${
                isActive 
                  ? "bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-indigo-500/30 scale-105" 
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:scale-105"
              }`}>
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[8.5px] mt-1 font-bold tracking-tight ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"}`}>
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
              isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[8px] font-semibold tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
