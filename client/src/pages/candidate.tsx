import { useRoute } from "wouter";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  ExternalLink, 
  Copy, 
  Share2, 
  Eye, 
  ThumbsUp, 
  MessageCircle, 
  Clock, 
  Flame, 
  TrendingUp,
  Calendar,
  User,
  Tag
} from "lucide-react";
import { useCandidate } from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";

export default function CandidatePage() {
  const [, params] = useRoute("/candidate/:id");
  const [, setLocation] = useLocation();
  const candidateId = params?.id || null;
  const { data: candidate, isLoading, error } = useCandidate(candidateId);

  const handleClip = async () => {
    const videoUrl = candidate?.url || `https://www.youtube.com/watch?v=${candidateId}`;
    try {
      await navigator.clipboard.writeText(videoUrl);
      toast({
        title: "URL Copied!",
        description: "Video URL has been copied to your clipboard.",
        duration: 2000,
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy URL to clipboard.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleShare = async () => {
    const videoUrl = candidate?.url || `https://www.youtube.com/watch?v=${candidateId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: candidate?.title || "Video",
          text: candidate?.title || "",
          url: videoUrl,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      handleClip();
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-primary";
    if (score >= 80) return "text-secondary";
    return "text-muted-foreground";
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 90) return "default";
    if (score >= 80) return "secondary";
    return "outline";
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !candidate) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto space-y-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/feed")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Feed
          </Button>
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : "Candidate not found"}
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => setLocation("/feed")}
          className="mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Feed
        </Button>

        {/* Hero Section */}
        <div className="relative rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-card to-card/50">
          {/* Thumbnail Background */}
          <div className="absolute inset-0 opacity-20">
            <img 
              src={candidate.thumbnail || '/placeholder.png'} 
              alt={candidate.title}
              className="w-full h-full object-cover blur-3xl scale-110"
            />
          </div>

          <div className="relative p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-start">
              {/* Thumbnail */}
              <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-border/50 shadow-2xl">
                <img 
                  src={candidate.thumbnail || '/placeholder.png'} 
                  alt={candidate.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.png';
                  }}
                />
                <div className="absolute top-3 left-3">
                  <Badge variant={getScoreBadgeVariant(candidate.score)} className="font-mono text-xs">
                    Score: {Math.round(candidate.score)}
                  </Badge>
                </div>
                <div className="absolute bottom-3 right-3 bg-black/80 px-2 py-1 rounded text-xs font-mono text-white">
                  {formatDuration(candidate.durationSeconds)}
                </div>
              </div>

              {/* Title & Info */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">
                      {candidate.category}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {candidate.entity}
                    </Badge>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-heading font-bold mb-4 leading-tight">
                    {candidate.title}
                  </h1>
                </div>

                {/* Channel & Date */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span className="font-medium">{candidate.channel || 'Unknown Channel'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {candidate.publishedAt 
                        ? format(new Date(candidate.publishedAt), "PPpp")
                        : 'Unknown date'}
                    </span>
                    <span className="text-xs">
                      ({candidate.publishedAt 
                        ? formatDistanceToNow(new Date(candidate.publishedAt), { addSuffix: true })
                        : ''})
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-4">
                  <Button 
                    onClick={handleClip}
                    className="bg-primary text-black hover:bg-primary/90"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy URL
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleShare}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                  <Button 
                    variant="outline"
                    asChild
                  >
                    <a 
                      href={candidate.url || `https://www.youtube.com/watch?v=${candidate.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Watch on YouTube
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Eye className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Views</p>
                  <p className="text-2xl font-bold font-mono">{formatNumber(candidate.views)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <ThumbsUp className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Likes</p>
                  <p className="text-2xl font-bold font-mono">{formatNumber(candidate.likes)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Flame className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Velocity</p>
                  <p className="text-2xl font-bold font-mono">{formatNumber(candidate.velocity)}/hr</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${getScoreColor(candidate.score)}/10`}>
                  <TrendingUp className={`w-5 h-5 ${getScoreColor(candidate.score)}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Score</p>
                  <p className={`text-2xl font-bold font-mono ${getScoreColor(candidate.score)}`}>
                    {Math.round(candidate.score)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats */}
        {(candidate.comments !== undefined || candidate.durationSeconds !== undefined) && (
          <div className="grid grid-cols-2 gap-4">
            {candidate.comments !== undefined && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Comments</p>
                      <p className="text-xl font-bold font-mono">{formatNumber(candidate.comments)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {candidate.durationSeconds !== undefined && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
                      <p className="text-xl font-bold font-mono">{formatDuration(candidate.durationSeconds)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Description */}
        {candidate.description && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Description
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {candidate.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Metadata</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Video ID</p>
                <p className="font-mono text-xs break-all">{candidate.id}</p>
              </div>
              {candidate.runDate && (
                <div>
                  <p className="text-muted-foreground mb-1">Scanned On</p>
                  <p className="font-mono text-xs">
                    {format(new Date(candidate.runDate), "PPpp")}
                  </p>
                </div>
              )}
              {candidate.channelId && (
                <div>
                  <p className="text-muted-foreground mb-1">Channel ID</p>
                  <p className="font-mono text-xs break-all">{candidate.channelId}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground mb-1">Category</p>
                <Badge variant="outline" className="font-mono text-xs uppercase">
                  {candidate.category}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}




