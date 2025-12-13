import { VideoCandidate } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Copy, Share2, Flame, Clock, Eye, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function TrendCard({ candidate }: { candidate: VideoCandidate }) {
  const scoreColor = candidate.score >= 90 ? "text-primary" : candidate.score >= 80 ? "text-secondary" : "text-muted-foreground";
  const borderColor = candidate.score >= 90 ? "border-primary/50" : "border-border";

  return (
    <Card className={`group relative overflow-hidden bg-card border ${borderColor} hover:border-primary transition-all duration-300`}>
      {/* Background Gradient on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="flex flex-col sm:flex-row h-full">
        {/* Image Section - Reduced height on mobile, narrower on desktop */}
        <div className="relative h-32 sm:h-auto sm:w-56 shrink-0 overflow-hidden bg-muted">
          <img 
            src={candidate.thumbnail || '/placeholder.png'} 
            alt={candidate.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.png';
            }}
          />
          <div className="absolute top-2 left-2">
             <Badge variant="secondary" className="bg-black/80 backdrop-blur-sm text-white border-white/10 font-mono text-[10px] uppercase px-1.5 py-0 h-5">
                {candidate.category}
             </Badge>
          </div>
          <div className="absolute bottom-2 right-2 bg-black/90 px-1.5 py-0.5 rounded text-[10px] font-mono text-white leading-none">
            12:45
          </div>
        </div>

        {/* Content Section */}
        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between relative min-h-[160px] sm:min-h-[180px]">
          
          <div>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono flex-1 min-w-0 mr-2">
                <span className="text-foreground font-semibold truncate">{candidate.channel || 'Unknown'}</span>
                <span className="shrink-0">•</span>
                <span className="shrink-0">
                  {candidate.publishedAt 
                    ? formatDistanceToNow(new Date(candidate.publishedAt), { addSuffix: true })
                    : 'Recently'}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                 <span className={`font-mono text-2xl font-bold ${scoreColor}`}>
                    {candidate.score}
                 </span>
                 <span className="text-[10px] text-muted-foreground uppercase tracking-widest hidden xs:inline">Score</span>
              </div>
            </div>

            <h3 className="font-heading font-semibold text-lg leading-tight mb-4 group-hover:text-primary transition-colors line-clamp-2">
              {candidate.title}
            </h3>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
               <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase truncate">Views</span>
                  <span className="font-mono font-medium flex items-center gap-1 text-xs sm:text-sm truncate">
                    <Eye className="w-3 h-3 text-muted-foreground shrink-0" />
                    {(candidate.views / 1000).toFixed(1)}K
                  </span>
               </div>
               <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase truncate">Velocity</span>
                  <span className="font-mono font-medium flex items-center gap-1 text-primary text-xs sm:text-sm truncate">
                    <Flame className="w-3 h-3 shrink-0" />
                    {(candidate.velocity || 0).toLocaleString()}/hr
                  </span>
               </div>
               <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase truncate">Entity</span>
                  <span className="font-mono font-medium truncate text-xs sm:text-sm" title={candidate.entity}>
                    {candidate.entity}
                  </span>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" className="flex-1 bg-primary text-black hover:bg-primary/90 font-medium h-9 sm:h-9">
              <Copy className="w-4 h-4 mr-2" /> <span className="sm:inline">Clip This</span>
            </Button>
            <Button size="icon" variant="outline" className="shrink-0 hover:bg-muted h-9 w-9">
              <Share2 className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="outline" className="shrink-0 hover:bg-muted h-9 w-9" asChild>
                <a href="#" target="_blank"><ArrowUpRight className="w-4 h-4" /></a>
            </Button>
          </div>

        </div>
      </div>
    </Card>
  );
}
