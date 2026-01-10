import { VideoCandidate } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Copy, Share2, Flame, Clock, Eye, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { Link } from "wouter";

// Helper to format duration in seconds to MM:SS or HH:MM:SS
function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return "0:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function TrendCard({ candidate }: { candidate: VideoCandidate }) {
  const scoreColor = candidate.score >= 90 ? "text-primary" : candidate.score >= 80 ? "text-secondary" : "text-muted-foreground";
  const borderColor = candidate.score >= 90 ? "border-primary/50" : "border-border";

  const handleClip = async () => {
    // Construct YouTube URL if not provided
    const videoUrl = candidate.url || `https://www.youtube.com/watch?v=${candidate.id}`;
    
    try {
      await navigator.clipboard.writeText(videoUrl);
      toast({
        title: "URL Copied!",
        description: "Video URL has been copied to your clipboard.",
        duration: 2000,
      });
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = videoUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        toast({
          title: "URL Copied!",
          description: "Video URL has been copied to your clipboard.",
          duration: 2000,
        });
      } catch (fallbackErr) {
        toast({
          title: "Copy Failed",
          description: "Failed to copy URL to clipboard. Please copy manually.",
          variant: "destructive",
          duration: 3000,
        });
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <Card className={`group relative overflow-hidden bg-card border ${borderColor} hover:border-primary transition-all duration-300`}>
      {/* Background Gradient on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="flex flex-col h-full">
        <Link href={`/candidate/${candidate.id}`} className="block flex-1">
          {/* Image Section - Compact square thumbnail */}
          <div className="relative w-full aspect-video shrink-0 overflow-hidden bg-muted cursor-pointer">
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
              {formatDuration(candidate.durationSeconds || 0)}
            </div>
          </div>

          {/* Content Section - Compact spacing */}
          <div className="p-3 flex-1 flex flex-col justify-between relative">
            
            <div>
              <div className="flex justify-between items-start mb-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono flex-1 min-w-0 mr-2">
                  <span className="text-foreground font-semibold truncate text-xs">{candidate.channel || 'Unknown'}</span>
                  <span className="shrink-0">•</span>
                  <span className="shrink-0">
                    {candidate.publishedAt 
                      ? formatDistanceToNow(new Date(candidate.publishedAt), { addSuffix: true })
                      : 'Recently'}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                   <span className={`font-mono text-xl font-bold ${scoreColor}`}>
                      {candidate.score ? Math.round(candidate.score) : 'N/A'}
                   </span>
                </div>
              </div>

              <h3 className="font-heading font-semibold text-sm leading-tight mb-2.5 group-hover:text-primary transition-colors line-clamp-2">
                {candidate.title}
              </h3>

              <div className="grid grid-cols-3 gap-2 mb-3">
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
          </div>
        </Link>

        <div className="px-3 pb-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            <Button 
              size="sm" 
              className="flex-1 bg-primary text-black hover:bg-primary/90 font-medium h-8 text-xs"
              onClick={handleClip}
            >
              <Copy className="w-3 h-3 mr-1.5" /> <span>Clip</span>
            </Button>
            <Button size="icon" variant="outline" className="shrink-0 hover:bg-muted h-8 w-8">
              <Share2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="outline" className="shrink-0 hover:bg-muted h-8 w-8" asChild>
                <a href={candidate.url || "#"} target="_blank" rel="noopener noreferrer"><ArrowUpRight className="w-3.5 h-3.5" /></a>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
