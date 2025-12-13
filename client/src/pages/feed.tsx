import { useState } from "react";
import Layout from "@/components/layout";
import { TrendCard } from "@/components/trend-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Radio, Zap, Loader2, Music, Trophy, Users, Newspaper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCandidates, useScannerStats, useMetrics, useBackendHealth } from "@/lib/api";
import { BackendStatus } from "@/components/backend-status";
import { cn } from "@/lib/utils";

type CategoryFilter = "all" | "hip_hop" | "nba" | "celebrity";

export default function Feed() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const categoryFilter = selectedCategory === "all" ? undefined : selectedCategory;
  const { data: items = [], isLoading, isFetching } = useCandidates(categoryFilter, 0);
  const { data: scannerStats } = useScannerStats();
  const { data: metrics } = useMetrics();
  const { data: health } = useBackendHealth();
  const isScanning = isFetching;

  // Calculate active entities count from metrics
  const activeEntitiesCount = metrics?.activeEntities || 0;

  const categoryFilters: { value: CategoryFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "all", label: "All", icon: Newspaper },
    { value: "hip_hop", label: "Hip Hop", icon: Music },
    { value: "nba", label: "NBA", icon: Trophy },
    { value: "celebrity", label: "Celebrity", icon: Users },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <BackendStatus />
        
        {/* Header */}
        <div className="flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-md py-4 border-b border-border -mx-8 px-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-heading font-bold mb-1">Live Feed</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-mono font-bold animate-pulse">
                <Radio className="w-3 h-3" />
                LIVE
              </div>
            </div>
            <p className="text-muted-foreground font-mono text-sm">
              Real-time scanner output. Monitoring {activeEntitiesCount} entities.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
             {isScanning && (
               <div className="flex items-center gap-2 text-primary font-mono text-xs">
                 <Loader2 className="w-3 h-3 animate-spin" />
                 SCANNING YOUTUBE API...
               </div>
             )}
             <div className="h-8 w-px bg-border" />
             <Button 
               variant="outline" 
               size="sm" 
               onClick={() => { /* Logic to pause/resume scanner */ }}
               disabled={!health?.status || health.status !== "ok"}
             >
               {isScanning ? "Pause Scanner" : "Resume Scanner"}
             </Button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground font-mono mr-2">Filter:</span>
          {categoryFilters.map((filter) => {
            const Icon = filter.icon;
            const isActive = selectedCategory === filter.value;
            return (
              <Button
                key={filter.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(filter.value)}
                className={cn(
                  "font-medium transition-all",
                  isActive 
                    ? "bg-primary text-black hover:bg-primary/90" 
                    : "hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4 mr-2" />
                {filter.label}
                {isActive && items.length > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-black/20 text-black font-mono">
                    {items.length}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>

        {/* Scanner Visualizer */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className="bg-card border border-border p-4 rounded-lg flex items-center justify-between">
              <div>
                 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Scan Rate</p>
                 <p className="text-2xl font-mono font-bold text-primary">
                   {scannerStats?.scanRate || 0}<span className="text-sm text-muted-foreground ml-1">items/s</span>
                 </p>
              </div>
              <Zap className="w-8 h-8 text-primary/20" />
           </div>
           <div className="bg-card border border-border p-4 rounded-lg flex items-center justify-between">
              <div>
                 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Last 10m</p>
                 <p className="text-2xl font-mono font-bold">
                   {scannerStats?.last10m || 0}<span className="text-sm text-muted-foreground ml-1">videos</span>
                 </p>
              </div>
              <div className="h-8 w-16 flex items-end gap-1">
                 {/* Simple visualization - could be enhanced with real data */}
                 <div className="w-full bg-primary/40 rounded-t-sm" style={{ height: '60%' }} />
                 <div className="w-full bg-primary/40 rounded-t-sm" style={{ height: '80%' }} />
                 <div className="w-full bg-primary/40 rounded-t-sm" style={{ height: '40%' }} />
              </div>
           </div>
           <div className="bg-card border border-border p-4 rounded-lg md:col-span-2 flex items-center gap-4">
              <div className="text-xs font-mono text-muted-foreground whitespace-nowrap">ACTIVE TARGETS:</div>
              <div className="flex flex-wrap gap-2">
                 {scannerStats?.activeEntities && scannerStats.activeEntities.length > 0 ? (
                   <>
                     {scannerStats.activeEntities.slice(0, 5).map(tag => (
                       <Badge key={tag} variant="secondary" className="font-mono text-[10px]">{tag}</Badge>
                     ))}
                     {scannerStats.activeEntities.length > 5 && (
                       <Badge variant="outline" className="font-mono text-[10px]">
                         +{scannerStats.activeEntities.length - 5} more
                       </Badge>
                     )}
                   </>
                 ) : (
                   <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                     No active targets
                   </Badge>
                 )}
              </div>
           </div>
        </div>

        {/* Feed Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence initial={false}>
              {items.map((candidate) => (
                <motion.div
                  key={candidate.id}
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  layout
                >
                  <TrendCard candidate={candidate} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No candidates found. Run a scan to discover trending content!
          </div>
        )}

      </div>
    </Layout>
  );
}
