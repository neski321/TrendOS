import { useState } from "react";
import Layout from "@/components/layout";
import { TrendCard } from "@/components/trend-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Radio, Zap, Loader2, Music, Trophy, Users, Newspaper, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCandidates, useScannerStats, useMetrics, useBackendHealth, useScanStatus } from "@/lib/api";
import { BackendStatus } from "@/components/backend-status";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

type CategoryFilter = "all" | "hip_hop" | "nba" | "celebrity";

export default function Feed() {
  const [location, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [showAllEntities, setShowAllEntities] = useState(false);
  
  // Parse URL query parameters for minScore
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const minScoreParam = urlParams.get('minScore');
  const minScore = minScoreParam ? parseFloat(minScoreParam) : 0;
  const isHighScoreView = minScore >= 90;
  
  const categoryFilter = selectedCategory === "all" ? undefined : selectedCategory;
  const { data: items = [], isLoading, isFetching } = useCandidates(categoryFilter, minScore);
  const { data: scannerStats } = useScannerStats();
  const { data: metrics } = useMetrics();
  const { data: health } = useBackendHealth();
  const { data: scanStatus } = useScanStatus();
  // Use actual scan status from backend, not query fetching state
  const isScanning = scanStatus?.isRunning ?? false;

  // Calculate active entities count from metrics
  const activeEntitiesCount = metrics?.activeEntities || 0;
  
  // Filter items by selected entity if one is selected
  const filteredItems = selectedEntity 
    ? items.filter(item => item.entity.toLowerCase() === selectedEntity.toLowerCase())
    : items;
  
  // Get active entities from scanner stats (preferred) or extract from items
  const activeEntitiesList = scannerStats?.activeEntities && scannerStats.activeEntities.length > 0
    ? scannerStats.activeEntities
    : Array.from(new Set(items.map(item => item.entity)));
  
  // Show first 5 entities, or all if expanded
  const displayedEntities = showAllEntities 
    ? activeEntitiesList 
    : activeEntitiesList.slice(0, 5);
  const remainingCount = activeEntitiesList.length > 5 ? activeEntitiesList.length - 5 : 0;

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
              {isHighScoreView && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 text-primary text-xs font-mono font-bold">
                  <Sparkles className="w-3 h-3" />
                  SCORE &gt; {minScore}
                </div>
              )}
              {!isHighScoreView && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-mono font-bold animate-pulse">
                  <Radio className="w-3 h-3" />
                  LIVE
                </div>
              )}
            </div>
            <p className="text-muted-foreground font-mono text-sm">
              {isHighScoreView 
                ? `Showing premium candidates with score > ${minScore}. Only the highest quality clip targets.`
                : `Real-time scanner output. Monitoring ${activeEntitiesCount} entities.`}
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

        {/* High Score Indicator Banner */}
        {isHighScoreView && (
          <div className="relative overflow-hidden rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50" />
            <div className="relative flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary mb-0.5">Premium Clip Targets</h3>
                <p className="text-xs text-muted-foreground">
                  Showing only candidates with score &gt; {minScore}. These are the highest quality trending videos optimized for clipping.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation('/feed')}
                className="border-primary/30 text-primary hover:bg-primary/10"
              >
                Show All
              </Button>
            </div>
          </div>
        )}

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
                 {displayedEntities.length > 0 ? (
                   <>
                     {displayedEntities.map(entity => {
                       const isSelected = selectedEntity?.toLowerCase() === entity.toLowerCase();
                       return (
                         <Badge 
                           key={entity} 
                           variant={isSelected ? "default" : "secondary"}
                           className={cn(
                             "font-mono text-[10px] cursor-pointer transition-all hover:scale-105",
                             isSelected ? "bg-primary text-black" : "hover:bg-primary/20"
                           )}
                           onClick={() => setSelectedEntity(isSelected ? null : entity)}
                         >
                           {entity}
                         </Badge>
                       );
                     })}
                     {remainingCount > 0 && !showAllEntities && (
                       <Badge 
                         variant="outline" 
                         className="font-mono text-[10px] cursor-pointer hover:bg-muted border-border"
                         onClick={() => setShowAllEntities(true)}
                       >
                         +{remainingCount} more
                       </Badge>
                     )}
                     {showAllEntities && remainingCount > 0 && (
                       <Badge 
                         variant="outline" 
                         className="font-mono text-[10px] cursor-pointer hover:bg-muted border-border"
                         onClick={() => setShowAllEntities(false)}
                       >
                         Show less
                       </Badge>
                     )}
                     {selectedEntity && (
                       <Badge 
                         variant="outline" 
                         className="font-mono text-[10px] cursor-pointer hover:bg-destructive/20 text-destructive border-destructive/50"
                         onClick={() => setSelectedEntity(null)}
                       >
                         Clear filter
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

        {/* Entity Filter Indicator */}
        {selectedEntity && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <Badge variant="default" className="bg-primary text-black font-mono text-xs">
              {selectedEntity}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Showing {filteredItems.length} candidate{filteredItems.length !== 1 ? 's' : ''}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedEntity(null)}
              className="ml-auto text-xs h-6"
            >
              Clear
            </Button>
          </div>
        )}

        {/* Feed Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <AnimatePresence initial={false}>
              {filteredItems.map((candidate) => (
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
        ) : selectedEntity ? (
          <div className="text-center py-12 text-muted-foreground">
            No candidates found for "{selectedEntity}". 
            <Button 
              variant="link" 
              className="ml-2 text-primary"
              onClick={() => setSelectedEntity(null)}
            >
              Clear filter
            </Button>
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
