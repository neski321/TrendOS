import { useState, useEffect } from "react";
import Layout from "@/components/layout";
import { MOCK_CANDIDATES, VideoCandidate } from "@/lib/mock-data";
import { TrendCard } from "@/components/trend-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Radio, Zap, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Feed() {
  const [items, setItems] = useState<VideoCandidate[]>(MOCK_CANDIDATES);
  const [isScanning, setIsScanning] = useState(true);

  // Simulate incoming live data
  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly "scan" a new item by duplicating and modifying a mock item
      const randomItem = MOCK_CANDIDATES[Math.floor(Math.random() * MOCK_CANDIDATES.length)];
      const newItem = { 
        ...randomItem, 
        id: `live-${Date.now()}`,
        title: `[LIVE SCAN] ${randomItem.title}`,
        publishedAt: new Date().toISOString(),
        score: Math.floor(Math.random() * 20) + 70 // Random score 70-90
      };
      
      // 30% chance to add a new item
      if (Math.random() > 0.7) {
        setItems(prev => [newItem, ...prev].slice(0, 50));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        
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
              Real-time scanner output. Monitoring 48 entities.
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
             <Button variant="outline" size="sm" onClick={() => setIsScanning(!isScanning)}>
               {isScanning ? "Pause Scanner" : "Resume Scanner"}
             </Button>
          </div>
        </div>

        {/* Scanner Visualizer */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className="bg-card border border-border p-4 rounded-lg flex items-center justify-between">
              <div>
                 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Scan Rate</p>
                 <p className="text-2xl font-mono font-bold text-primary">2.4<span className="text-sm text-muted-foreground ml-1">items/s</span></p>
              </div>
              <Zap className="w-8 h-8 text-primary/20" />
           </div>
           <div className="bg-card border border-border p-4 rounded-lg flex items-center justify-between">
              <div>
                 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Last 10m</p>
                 <p className="text-2xl font-mono font-bold">142<span className="text-sm text-muted-foreground ml-1">videos</span></p>
              </div>
              <div className="h-8 w-16 flex items-end gap-1">
                 {[40, 60, 30, 80, 50, 90, 45].map((h, i) => (
                    <div key={i} style={{ height: `${h}%` }} className="w-full bg-primary/40 rounded-t-sm" />
                 ))}
              </div>
           </div>
           <div className="bg-card border border-border p-4 rounded-lg md:col-span-2 flex items-center gap-4">
              <div className="text-xs font-mono text-muted-foreground whitespace-nowrap">ACTIVE TARGETS:</div>
              <div className="flex flex-wrap gap-2">
                 {["Drake", "Kendrick", "LeBron", "Curry", "Kai Cenat"].map(tag => (
                    <Badge key={tag} variant="secondary" className="font-mono text-[10px]">{tag}</Badge>
                 ))}
                 <Badge variant="outline" className="font-mono text-[10px]">+43 more</Badge>
              </div>
           </div>
        </div>

        {/* Feed Grid */}
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

      </div>
    </Layout>
  );
}
