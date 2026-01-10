import Layout from "@/components/layout";
import { TrendCard } from "@/components/trend-card";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, TrendingUp, Users, Activity, PlayCircle, Zap, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useMetrics, useTopPicks, useTriggerScan, useScanStatus } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useMetrics();
  const { data: topPicks = [], isLoading: picksLoading } = useTopPicks(4);
  const triggerScan = useTriggerScan();
  const { data: scanStatus, isLoading: scanStatusLoading } = useScanStatus();
  
  // Use live data or fallback to empty arrays
  const velocityData = metrics?.velocityData || [];
  const categoryData = metrics?.categoryCounts || [];

  const handleQuickScan = () => {
    triggerScan.mutate();
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Scan Status Banner */}
        {!scanStatusLoading && scanStatus?.isRunning && scanStatus.scan && (
          <Alert className="bg-primary/10 border-primary/20">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <AlertTitle className="text-primary font-semibold">Scan Running</AlertTitle>
            <AlertDescription className="text-sm">
              <div className="mt-1">
                <p className="font-medium">{scanStatus.scan.progress_message || "Processing..."}</p>
                {scanStatus.scan.candidates_found > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Found: {scanStatus.scan.candidates_found} candidates
                    {scanStatus.scan.candidates_saved > 0 && ` • Saved: ${scanStatus.scan.candidates_saved}`}
                  </p>
                )}
                {scanStatus.scan.started_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Started: {new Date(scanStatus.scan.started_at).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-1">Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Overview of daily trends, system health, and top performing content.
            </p>
          </div>
          <Button 
            onClick={handleQuickScan} 
            disabled={triggerScan.isPending}
            className="bg-primary text-black hover:bg-primary/90 font-medium"
          >
            {triggerScan.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Triggering Scan...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Run Quick Scan
              </>
            )}
          </Button>
        </div>

        {/* Key Metrics */}
        {metricsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Scanned</p>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold font-mono">{metrics?.totalScanned?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  All time candidates
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Avg. Velocity</p>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold font-mono">
                  {metrics?.avgVelocity ? `${(metrics.avgVelocity / 1000).toFixed(1)}k` : '0'}<span className="text-sm font-sans text-muted-foreground font-normal">/hr</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all categories
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Entities</p>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold font-mono">{metrics?.activeEntities || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Unique entities tracked
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Clip Candidates</p>
                  <PlayCircle className="h-4 w-4 text-secondary" />
                </div>
                <div className="text-2xl font-bold font-mono">{metrics?.clipCandidates || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Score &gt; 85 (High Potential)
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-border">
             <CardHeader>
                <CardTitle className="text-base font-mono uppercase">Global View Velocity (24h)</CardTitle>
                <CardDescription>Aggregate views per hour across all tracked entities.</CardDescription>
             </CardHeader>
             <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={velocityData}>
                    <defs>
                      <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00E599" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00E599" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="time" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#09090b', borderColor: '#333', borderRadius: '4px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="views" stroke="#00E599" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" />
                  </AreaChart>
                </ResponsiveContainer>
             </CardContent>
          </Card>

          <Card className="border-border">
             <CardHeader>
                <CardTitle className="text-base font-mono uppercase">Volume by Category</CardTitle>
                <CardDescription>Video candidates found today.</CardDescription>
             </CardHeader>
             <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={categoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                      <XAxis type="number" stroke="#666" fontSize={12} hide />
                      <YAxis dataKey="name" type="category" stroke="#fff" fontSize={12} width={60} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#09090b', borderColor: '#333' }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={30}>
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
             </CardContent>
          </Card>
        </div>

        {/* Top Picks Section */}
        <div>
           <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-semibold">🔥 Top Clip Targets (Score &gt; 90)</h2>
              <Button variant="ghost" className="text-xs font-mono text-muted-foreground hover:text-foreground" asChild>
                <Link href="/feed?minScore=90">VIEW ALL CANDIDATES &rarr;</Link>
              </Button>
           </div>
           {picksLoading ? (
             <div className="flex items-center justify-center py-12">
               <Loader2 className="w-6 h-6 animate-spin text-primary" />
             </div>
           ) : topPicks.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
               {topPicks.map(candidate => (
                 <TrendCard key={candidate.id} candidate={candidate} />
               ))}
             </div>
           ) : (
             <div className="text-center py-12 text-muted-foreground">
               No top picks found. Run a scan to discover trending content!
             </div>
           )}
        </div>
      </div>
    </Layout>
  );
}
