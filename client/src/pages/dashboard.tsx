import { useState } from "react";
import Layout from "@/components/layout";
import { MOCK_CANDIDATES, MOCK_LOGS, Category } from "@/lib/mock-data";
import { TrendCard } from "@/components/trend-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("all");
  
  const filteredCandidates = activeTab === "all" 
    ? MOCK_CANDIDATES 
    : MOCK_CANDIDATES.filter(c => c.category === activeTab);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-1">Mission Control</h1>
            <p className="text-muted-foreground font-mono text-sm">
              System Status: <span className="text-primary">OPERATIONAL</span> • Last Scan: 2 mins ago
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            <Button size="sm" className="bg-primary text-black hover:bg-primary/90">
              Run Manual Scan
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="all" onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-muted border border-border h-10">
                  <TabsTrigger value="all" className="font-mono text-xs">ALL</TabsTrigger>
                  <TabsTrigger value="hip_hop" className="font-mono text-xs">HIP HOP</TabsTrigger>
                  <TabsTrigger value="nba" className="font-mono text-xs">NBA</TabsTrigger>
                  <TabsTrigger value="celebrity" className="font-mono text-xs">CELEBRITY</TabsTrigger>
                </TabsList>
                
                <div className="flex items-center gap-2">
                  <div className="relative w-40 hidden sm:block">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <Input className="h-8 pl-8 text-xs bg-muted border-transparent focus-visible:border-primary" placeholder="Search entity..." />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Filter className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <TabsContent value="all" className="space-y-4 mt-0">
                {filteredCandidates.map(candidate => (
                  <TrendCard key={candidate.id} candidate={candidate} />
                ))}
              </TabsContent>
              <TabsContent value="hip_hop" className="space-y-4 mt-0">
                {filteredCandidates.map(candidate => (
                  <TrendCard key={candidate.id} candidate={candidate} />
                ))}
              </TabsContent>
              <TabsContent value="nba" className="space-y-4 mt-0">
                {filteredCandidates.map(candidate => (
                  <TrendCard key={candidate.id} candidate={candidate} />
                ))}
              </TabsContent>
              <TabsContent value="celebrity" className="space-y-4 mt-0">
                {filteredCandidates.map(candidate => (
                  <TrendCard key={candidate.id} candidate={candidate} />
                ))}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar Widgets */}
          <div className="space-y-6">
            
            {/* Live Logs */}
            <Card className="bg-black border-border shadow-lg">
              <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">System Logs</CardTitle>
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px] p-4 font-mono text-xs">
                  <div className="space-y-3">
                    {MOCK_LOGS.map(log => (
                      <div key={log.id} className="flex gap-3">
                        <span className="text-muted-foreground shrink-0 opacity-50">{log.timestamp}</span>
                        <span className={
                          log.level === 'error' ? 'text-destructive' :
                          log.level === 'warn' ? 'text-yellow-500' :
                          log.level === 'success' ? 'text-primary' :
                          'text-foreground'
                        }>
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="border-border">
              <CardHeader className="py-3 px-4 border-b border-border">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Daily Metrics</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Candidates Scanned</span>
                  <span className="font-mono font-bold">1,248</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">High Score (&gt;80)</span>
                  <span className="font-mono font-bold text-primary">42</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Discord Alerts</span>
                  <span className="font-mono font-bold">15</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg. Velocity</span>
                  <span className="font-mono font-bold">12k/hr</span>
                </div>
              </CardContent>
            </Card>

            <div className="p-4 rounded-lg border border-dashed border-border bg-sidebar/50">
               <h4 className="text-xs font-heading font-bold uppercase mb-2 text-muted-foreground">Next Scheduled Run</h4>
               <p className="font-mono text-xl">12:00:00</p>
               <p className="text-xs text-muted-foreground mt-1">in 45 minutes</p>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
