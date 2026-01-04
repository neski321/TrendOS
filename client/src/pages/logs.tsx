import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Download, Pause, Play, Trash2, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogs, useScanHistory, useScanStatus, useTerminateScan } from "@/lib/api";

export default function Logs() {
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const { data: logs = [], isLoading } = useLogs();
  const { data: scanHistory = [], isLoading: historyLoading } = useScanHistory(10);
  const { data: scanStatus } = useScanStatus();
  const terminateScan = useTerminateScan();
  
  // Filter logs based on search
  const filteredLogs = logs.filter(log => 
    log.message.toLowerCase().includes(filter.toLowerCase()) || 
    log.module?.toLowerCase().includes(filter.toLowerCase()) ||
    log.level.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-1">System Logs</h1>
            <p className="text-muted-foreground font-mono text-sm">
              Real-time execution trace and error reporting.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? "Resume" : "Pause Output"}
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" /> Export
            </Button>
            <Button variant="destructive" size="sm" className="gap-2">
               <Trash2 className="w-4 h-4" /> Clear
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 shrink-0 bg-card p-2 rounded-lg border border-border">
          <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
             <Input 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-9 font-mono text-sm bg-background border-border" 
                placeholder="Filter logs by keyword, module, or level..." 
             />
          </div>
          <div className="flex items-center gap-2 px-2">
             <Badge variant="outline" className="cursor-pointer hover:bg-muted">ALL</Badge>
             <Badge variant="outline" className="cursor-pointer hover:bg-muted text-primary border-primary/20 bg-primary/5">INFO</Badge>
             <Badge variant="outline" className="cursor-pointer hover:bg-muted text-yellow-500 border-yellow-500/20 bg-yellow-500/5">WARN</Badge>
             <Badge variant="outline" className="cursor-pointer hover:bg-muted text-destructive border-destructive/20 bg-destructive/5">ERROR</Badge>
          </div>
        </div>

        {/* Scan History Section */}
        <div>
          <h2 className="text-xl font-heading font-semibold mb-4">📊 Scan History</h2>
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : scanHistory.length > 0 ? (
            <Card className="border-border">
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {scanHistory.map((scan) => {
                    const startDate = scan.started_at ? new Date(scan.started_at) : null;
                    const endDate = scan.completed_at ? new Date(scan.completed_at) : null;
                    const duration = startDate && endDate 
                      ? Math.round((endDate.getTime() - startDate.getTime()) / 1000 / 60)
                      : null;
                    
                    const statusIcon = scan.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : scan.status === 'failed' ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : scan.status === 'running' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    );

                    const statusColor = scan.status === 'completed' 
                      ? 'text-green-500' 
                      : scan.status === 'failed' 
                      ? 'text-red-500' 
                      : scan.status === 'running'
                      ? 'text-primary'
                      : 'text-yellow-500';

                    const isRunning = scan.status === 'running';
                    const canTerminate = isRunning && scanStatus?.isRunning && scanStatus.scan?.scan_id === scan.scan_id;

                    return (
                      <div key={scan.scan_id} className="p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            {statusIcon}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-semibold capitalize ${statusColor}`}>
                                  {scan.status}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {scan.scan_id}
                                </span>
                              </div>
                              {scan.progress_message && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {scan.progress_message}
                                </p>
                              )}
                              {scan.error_message && (
                                <p className="text-sm text-red-400 mb-2">
                                  {scan.error_message}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                {startDate && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>Started: {startDate.toLocaleString()}</span>
                                  </div>
                                )}
                                {endDate && (
                                  <div className="flex items-center gap-1">
                                    <span>Completed: {endDate.toLocaleString()}</span>
                                  </div>
                                )}
                                {duration !== null && (
                                  <span>Duration: {duration} min</span>
                                )}
                                {scan.candidates_found > 0 && (
                                  <span>Found: {scan.candidates_found}</span>
                                )}
                                {scan.candidates_saved > 0 && (
                                  <span>Saved: {scan.candidates_saved}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {canTerminate && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => terminateScan.mutate(scan.scan_id)}
                              disabled={terminateScan.isPending}
                              className="gap-2"
                            >
                              {terminateScan.isPending ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Terminating...
                                </>
                              ) : (
                                <>
                                  <StopCircle className="w-3 h-3" />
                                  Terminate
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border">
              <CardContent className="p-12 text-center text-muted-foreground">
                No scan history available. Run your first scan to get started!
              </CardContent>
            </Card>
          )}
        </div>

        {/* Terminal Window */}
        <Card className="flex-1 bg-black border-border shadow-2xl overflow-hidden flex flex-col font-mono text-sm">
           <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2">
                 <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                 </div>
                 <span className="text-xs text-muted-foreground ml-2">user@trend-os:~/logs</span>
              </div>
              <div className="text-xs text-muted-foreground">bash - 80x24</div>
           </div>
           
           <ScrollArea className="flex-1 p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : filteredLogs.length > 0 ? (
                <div className="space-y-1">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 hover:bg-white/5 p-1 rounded -mx-1 group transition-colors">
                      <span className="text-muted-foreground opacity-50 w-20 shrink-0 select-none">{log.timestamp}</span>
                      <span className={cn(
                        "uppercase w-16 shrink-0 font-bold select-none text-center rounded px-1 text-[10px] py-0.5 self-start mt-0.5",
                        log.level === 'error' ? 'bg-destructive/20 text-destructive' :
                        log.level === 'warn' ? 'bg-yellow-500/20 text-yellow-500' :
                        log.level === 'success' ? 'bg-primary/20 text-primary' :
                        'bg-blue-500/20 text-blue-500'
                      )}>
                        {log.level}
                      </span>
                      {log.module && (
                        <span className="text-purple-400 w-24 shrink-0 hidden sm:block">[{log.module}]</span>
                      )}
                      <span className={cn(
                        "break-all",
                        log.level === 'error' ? 'text-red-200' : 
                        'text-gray-300'
                      )}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                  
                  {!isPaused && (
                    <div className="animate-pulse text-primary mt-2 flex items-center gap-2">
                      <span className="w-2 h-4 bg-primary block" />
                      <span className="opacity-50 text-xs">Awaiting new events...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No logs available. System logs will appear here when the scanner runs.
                </div>
              )}
           </ScrollArea>
        </Card>

      </div>
    </Layout>
  );
}
