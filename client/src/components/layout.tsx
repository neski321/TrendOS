import { Link, useLocation } from "wouter";
import { LayoutDashboard, Settings, Activity, Terminal, Zap, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useBackendHealth } from "@/lib/api";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: health, error: healthError } = useBackendHealth();

  const navItems = [
    { icon: LayoutDashboard, label: "Mission Control", href: "/" },
    { icon: Activity, label: "Live Feed", href: "/feed" },
    { icon: Terminal, label: "System Logs", href: "/logs" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      
      {/* Top Header - Minimal & Functional */}
      <header className="fixed top-0 left-0 right-0 h-16 border-b border-white/5 bg-background/60 backdrop-blur-xl z-50 px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_0_15px_rgba(157,140,255,0.3)] shrink-0">
            <Zap className="w-5 h-5 text-black fill-black" />
          </div>
          <div>
             <h1 className="font-heading font-bold text-lg leading-none tracking-tight">TrendOS</h1>
             <div className="flex items-center gap-1.5">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  healthError ? "bg-red-500 animate-pulse" : 
                  health?.status === "ok" ? "bg-green-500 animate-pulse" : 
                  "bg-yellow-500 animate-pulse"
                )} />
                <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                  {healthError ? "Backend Offline" : 
                   health?.status === "ok" ? "System Online" : 
                   "Checking..."}
                </span>
             </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6">
           <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">API Usage</span>
              <div className="w-32 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-primary to-secondary w-[82%]" />
              </div>
           </div>
           <div className="h-8 w-px bg-white/10" />
           <div className="font-mono text-xs text-muted-foreground">
              v2.0.0-beta
           </div>
        </div>

        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
           <Menu className="w-5 h-5" />
        </Button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-24 pb-32 px-4 md:px-8 max-w-[1600px] mx-auto w-full z-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Floating Dock Navigation - The "Engaging" Part */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-2 flex items-center justify-between gap-1 ring-1 ring-white/5">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            
            return (
              <Link key={item.href} href={item.href} className="flex-1 min-w-0">
                <motion.div 
                  className={cn(
                    "relative flex flex-col items-center justify-center h-16 rounded-xl cursor-pointer transition-all duration-300 w-full",
                    isActive ? "text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white/10 rounded-xl border border-white/10 shadow-inner"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center gap-1.5 overflow-hidden w-full px-1">
                    <item.icon className={cn("w-5 h-5 transition-colors shrink-0", isActive && "text-primary drop-shadow-[0_0_8px_rgba(157,140,255,0.8)]")} />
                    <span className="text-[10px] font-medium tracking-wide truncate w-full text-center">{item.label}</span>
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}
