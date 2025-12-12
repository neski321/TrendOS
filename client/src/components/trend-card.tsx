import { VideoCandidate } from "@/lib/mock-data";
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
        {/* Image Section */}
        <div className="relative sm:w-72 aspect-video sm:aspect-auto shrink-0 overflow-hidden">
          <img 
            src={candidate.thumbnail} 
            alt={candidate.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute top-2 left-2">
             <Badge variant="secondary" className="bg-black/80 backdrop-blur-sm text-white border-white/10 font-mono text-xs uppercase">
                {candidate.category}
             </Badge>
          </div>
          <div className="absolute bottom-2 right-2 bg-black/90 px-2 py-0.5 rounded text-[10px] font-mono text-white">
            12:45
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 flex-1 flex flex-col justify-between relative">
          
          <div>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span className="text-foreground font-semibold">{candidate.channel}</span>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(candidate.publishedAt), { addSuffix: true })}</span>
              </div>
              <div className="flex items-center gap-1">
                 <span className={`font-mono text-2xl font-bold ${scoreColor}`}>
                    {candidate.score}
                 </span>
                 <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Score</span>
              </div>
            </div>

            <h3 className="font-heading font-semibold text-lg leading-tight mb-4 group-hover:text-primary transition-colors line-clamp-2">
              {candidate.title}
            </h3>

            <div className="grid grid-cols-3 gap-4 mb-4">
               <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase">Views</span>
                  <span className="font-mono font-medium flex items-center gap-1">
                    <Eye className="w-3 h-3 text-muted-foreground" />
                    {(candidate.views / 1000).toFixed(1)}K
                  </span>
               </div>
               <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase">Velocity</span>
                  <span className="font-mono font-medium flex items-center gap-1 text-primary">
                    <Flame className="w-3 h-3" />
                    {candidate.velocity.toLocaleString()}/hr
                  </span>
               </div>
               <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase">Entity</span>
                  <span className="font-mono font-medium truncate" title={candidate.entity}>
                    {candidate.entity}
                  </span>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" className="flex-1 bg-primary text-black hover:bg-primary/90 font-medium">
              <Copy className="w-4 h-4 mr-2" /> Clip This
            </Button>
            <Button size="icon" variant="outline" className="shrink-0 hover:bg-muted">
              <Share2 className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="outline" className="shrink-0 hover:bg-muted" asChild>
                <a href="#" target="_blank"><ArrowUpRight className="w-4 h-4" /></a>
            </Button>
          </div>

        </div>
      </div>
    </Card>
  );
}
