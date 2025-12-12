import Layout from "@/components/layout";
import { MOCK_CANDIDATES } from "@/lib/mock-data";
import { TrendCard } from "@/components/trend-card";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, TrendingUp, Users, Activity, PlayCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

// Mock Analytics Data
const velocityData = [
  { time: '00:00', views: 4000 },
  { time: '04:00', views: 3000 },
  { time: '08:00', views: 12000 },
  { time: '12:00', views: 45000 },
  { time: '16:00', views: 32000 },
  { time: '20:00', views: 58000 },
  { time: '23:59', views: 42000 },
];

const categoryData = [
  { name: 'Hip Hop', count: 145, color: '#00E599' },
  { name: 'NBA', count: 86, color: '#7000FF' },
  { name: 'Celeb', count: 112, color: '#F59E0B' },
];

export default function Dashboard() {
  const topPicks = MOCK_CANDIDATES.filter(c => c.score > 90).slice(0, 3);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-heading font-bold mb-1">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Overview of daily trends, system health, and top performing content.
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Scanned</p>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold font-mono">2,543</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-primary">+20.1%</span> from yesterday
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Avg. Velocity</p>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold font-mono">18.2k<span className="text-sm font-sans text-muted-foreground font-normal">/hr</span></div>
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
              <div className="text-2xl font-bold font-mono">48</div>
              <p className="text-xs text-muted-foreground mt-1">
                3 new added today
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Clip Candidates</p>
                <PlayCircle className="h-4 w-4 text-secondary" />
              </div>
              <div className="text-2xl font-bold font-mono">12</div>
              <p className="text-xs text-muted-foreground mt-1">
                Score &gt; 85 (High Potential)
              </p>
            </CardContent>
          </Card>
        </div>

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
              <Button variant="ghost" className="text-xs font-mono text-muted-foreground hover:text-foreground">VIEW ALL CANDIDATES &rarr;</Button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topPicks.map(candidate => (
                 <TrendCard key={candidate.id} candidate={candidate} />
              ))}
           </div>
        </div>
      </div>
    </Layout>
  );
}
