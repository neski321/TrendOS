import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { VideoCandidate, LogEntry } from "./types";
import { toast } from "@/hooks/use-toast";

export interface Metrics {
  totalScanned: number;
  avgVelocity: number;
  activeEntities: number;
  clipCandidates: number;
  categoryCounts: Array<{
    name: string;
    count: number;
    color: string;
  }>;
  velocityData: Array<{
    time: string;
    views: number;
  }>;
}

// Helper to check if error is a network/connection error
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError") ||
      error.message.includes("Network request failed") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("Unexpected token") ||
      error.message.includes("<!DOCTYPE")
    );
  }
  return false;
}

// Helper to create user-friendly error message
function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    if (isNetworkError(error)) {
      return "Backend server is not available. Please ensure the server is running.";
    }
    // Clean up JSON parsing errors
    if (error.message.includes("Unexpected token") || error.message.includes("<!DOCTYPE")) {
      return "Backend server returned an invalid response. The server may not be running correctly.";
    }
    return error.message;
  }
  return defaultMessage;
}

// Track shown errors to prevent duplicates
const shownErrors = new Set<string>();

// Helper to show error toast (only once per unique error)
function showErrorToast(error: unknown, title: string) {
  const message = getErrorMessage(error, "An error occurred");
  const errorKey = `${title}:${message}`;
  
  // Only show if we haven't shown this exact error recently
  if (!shownErrors.has(errorKey)) {
    shownErrors.add(errorKey);
    toast({
      title,
      description: message,
      variant: "destructive",
      duration: 5000,
    });
    
    // Clear from set after 10 seconds to allow re-showing if error persists
    setTimeout(() => {
      shownErrors.delete(errorKey);
    }, 10000);
  }
}

// Fetch all candidates
export function useCandidates(category?: string, minScore = 0) {
  const query = useQuery<VideoCandidate[]>({
    queryKey: ["/api/candidates", category, minScore],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (category) params.append("category", category);
        params.append("minScore", minScore.toString());
        params.append("limit", "100");
        
        const res = await fetch(`/api/candidates?${params}`);
        if (!res.ok) {
          const errorText = await res.text().catch(() => res.statusText);
          // Check if response is HTML (error page)
          if (errorText.trim().startsWith("<!DOCTYPE") || errorText.trim().startsWith("<html")) {
            throw new Error("Backend server is not available");
          }
          throw new Error(`Failed to fetch candidates: ${res.status} ${errorText}`);
        }
        return res.json();
      } catch (error) {
        if (isNetworkError(error)) {
          throw new Error("Backend server is not available");
        }
        throw error;
      }
    },
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 2000,
  });

  // Show toast on error (only once per error state)
  useEffect(() => {
    if (query.error && query.isError && !query.isFetching) {
      showErrorToast(query.error, "Failed to Load Candidates");
    }
  }, [query.error, query.isError, query.isFetching]);

  return query;
}

// Fetch single candidate by ID
export function useCandidate(id: string | null) {
  return useQuery<VideoCandidate>({
    queryKey: ["/api/candidates", id],
    queryFn: async () => {
      if (!id) throw new Error("Candidate ID is required");
      const res = await fetch(`/api/candidates/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Candidate not found");
        }
        throw new Error(`Failed to fetch candidate: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!id,
    retry: 2,
    retryDelay: 2000,
  });
}

// Fetch dashboard metrics
export function useMetrics() {
  const query = useQuery<Metrics>({
    queryKey: ["/api/metrics"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/metrics");
        if (!res.ok) {
          const errorText = await res.text().catch(() => res.statusText);
          // Check if response is HTML (error page)
          if (errorText.trim().startsWith("<!DOCTYPE") || errorText.trim().startsWith("<html")) {
            throw new Error("Backend server is not available");
          }
          throw new Error(`Failed to fetch metrics: ${res.status} ${errorText}`);
        }
        return res.json();
      } catch (error) {
        if (isNetworkError(error)) {
          throw new Error("Backend server is not available");
        }
        throw error;
      }
    },
    refetchInterval: 60000,
    retry: 2,
    retryDelay: 2000,
  });

  // Show toast on error (only once per error state)
  useEffect(() => {
    if (query.error && query.isError && !query.isFetching) {
      showErrorToast(query.error, "Failed to Load Metrics");
    }
  }, [query.error, query.isError, query.isFetching]);

  return query;
}

// Fetch top picks
export function useTopPicks(limit = 3) {
  const query = useQuery<VideoCandidate[]>({
    queryKey: ["/api/top-picks", limit],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/top-picks?limit=${limit}`);
        if (!res.ok) {
          const errorText = await res.text().catch(() => res.statusText);
          // Check if response is HTML (error page)
          if (errorText.trim().startsWith("<!DOCTYPE") || errorText.trim().startsWith("<html")) {
            throw new Error("Backend server is not available");
          }
          throw new Error(`Failed to fetch top picks: ${res.status} ${errorText}`);
        }
        return res.json();
      } catch (error) {
        if (isNetworkError(error)) {
          throw new Error("Backend server is not available");
        }
        throw error;
      }
    },
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 2000,
  });

  // Show toast on error (only once per error state)
  useEffect(() => {
    if (query.error && query.isError && !query.isFetching) {
      showErrorToast(query.error, "Failed to Load Top Picks");
    }
  }, [query.error, query.isError, query.isFetching]);

  return query;
}

// Fetch system logs
export function useLogs() {
  const query = useQuery<LogEntry[]>({
    queryKey: ["/api/logs"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/logs");
        if (!res.ok) {
          const errorText = await res.text().catch(() => res.statusText);
          // Check if response is HTML (error page)
          if (errorText.trim().startsWith("<!DOCTYPE") || errorText.trim().startsWith("<html")) {
            throw new Error("Backend server is not available");
          }
          throw new Error(`Failed to fetch logs: ${res.status} ${errorText}`);
        }
        return res.json();
      } catch (error) {
        if (isNetworkError(error)) {
          throw new Error("Backend server is not available");
        }
        throw error;
      }
    },
    refetchInterval: 5000,
    retry: 1,
    retryDelay: 1000,
  });

  // Show toast on error (only once per error state)
  useEffect(() => {
    if (query.error && query.isError && !query.isFetching) {
      showErrorToast(query.error, "Failed to Load Logs");
    }
  }, [query.error, query.isError, query.isFetching]);

  return query;
}

// Entities configuration types
export interface CategoryConfig {
  entities: string[];
  channels: string[];
  category_keywords: string[];
  priority_weights: Record<string, number>;
}

export interface EntitiesConfig {
  categories: {
    hip_hop: CategoryConfig;
    nba: CategoryConfig;
    celebrity: CategoryConfig;
  };
  keywords: string[];
  time_window_hours: number;
  default_region: string;
}

// Fetch entities configuration
export function useEntities() {
  return useQuery<EntitiesConfig>({
    queryKey: ["/api/entities"],
    queryFn: async () => {
      const res = await fetch("/api/entities");
      if (!res.ok) {
        throw new Error("Failed to fetch entities");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Update entities configuration
export function useUpdateEntities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newEntities: EntitiesConfig) => {
      const res = await fetch("/api/entities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newEntities),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update entities");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities"] });
      toast({
        title: "Entities Saved",
        description: "Entity management configuration updated successfully.",
        duration: 5000,
      });
    },
    onError: (error: unknown) => {
      showErrorToast(error, "Failed to Save Entities");
    },
  });
}

// Fetch scanner stats
export function useScannerStats() {
  const query = useQuery<{
    scanRate: number;
    last10m: number;
    activeEntities: string[];
  }>({
    queryKey: ["/api/scanner-stats"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/scanner-stats");
        if (!res.ok) {
          const errorText = await res.text().catch(() => res.statusText);
          // Check if response is HTML (error page)
          if (errorText.trim().startsWith("<!DOCTYPE") || errorText.trim().startsWith("<html")) {
            throw new Error("Backend server is not available");
          }
          throw new Error(`Failed to fetch scanner stats: ${res.status} ${errorText}`);
        }
        return res.json();
      } catch (error) {
        if (isNetworkError(error)) {
          throw new Error("Backend server is not available");
        }
        throw error;
      }
    },
    refetchInterval: 10000,
    retry: 2,
    retryDelay: 2000,
  });

  // Show toast on error (only once per error state)
  useEffect(() => {
    if (query.error && query.isError && !query.isFetching) {
      showErrorToast(query.error, "Failed to Load Scanner Stats");
    }
  }, [query.error, query.isError, query.isFetching]);

  return query;
}

// Trigger a scan
export function useTriggerScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        const res = await fetch("/api/scan/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        
        if (!res.ok) {
          const errorText = await res.text().catch(() => res.statusText);
          if (errorText.trim().startsWith("<!DOCTYPE") || errorText.trim().startsWith("<html")) {
            throw new Error("Backend server is not available. Cannot trigger scan.");
          }
          throw new Error(`Failed to trigger scan: ${res.status} ${errorText}`);
        }
        
        return res.json();
      } catch (error) {
        if (isNetworkError(error)) {
          throw new Error("Backend server is not available. Cannot trigger scan.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Scan Triggered",
        description: "The scan has been initiated. Results will appear shortly.",
        duration: 3000,
      });
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/top-picks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scanner-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scan/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scan/history"] });
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, "Failed to trigger scan");
      toast({
        title: "Scan Failed",
        description: message,
        variant: "destructive",
        duration: 5000,
      });
    },
  });
}

// API Quota Usage interface
export interface QuotaUsage {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
}

// Get API quota usage
export function useQuotaUsage() {
  return useQuery({
    queryKey: ["/api/quota/usage"],
    queryFn: async (): Promise<QuotaUsage> => {
      const res = await fetch("/api/quota/usage");
      if (!res.ok) {
        throw new Error(`Failed to fetch quota usage: ${res.statusText}`);
      }
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Scan status interface
export interface ScanStatus {
  scan_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  progress_message: string | null;
  candidates_found: number;
  candidates_saved: number;
  created_at: string;
  updated_at: string;
}

export interface ScanStatusResponse {
  isRunning: boolean;
  scan: ScanStatus | null;
}

// Get current scan status
export function useScanStatus() {
  return useQuery({
    queryKey: ["/api/scan/status"],
    queryFn: async (): Promise<ScanStatusResponse> => {
      const res = await fetch("/api/scan/status");
      if (!res.ok) {
        throw new Error(`Failed to fetch scan status: ${res.statusText}`);
      }
      return res.json();
    },
    refetchInterval: (query) => {
      // Poll every 2 seconds if scan is running, otherwise every 30 seconds
      const data = query.state.data as ScanStatusResponse | undefined;
      return data?.isRunning ? 2000 : 30000;
    },
  });
}

// Get scan history
export function useScanHistory(limit: number = 10) {
  return useQuery({
    queryKey: ["/api/scan/history", limit],
    queryFn: async (): Promise<ScanStatus[]> => {
      const res = await fetch(`/api/scan/history?limit=${limit}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch scan history: ${res.statusText}`);
      }
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Settings interface
export interface Settings {
  scoring: {
    recency_weight: number;
    engagement_weight: number;
    velocity_weight: number;
    cross_platform_weight: number;
    entity_priority_weight: number;
  };
  limits: {
    max_candidates_per_category: number;
    top_n_per_category_for_discord: number;
    min_video_duration_seconds: number;
    max_video_duration_seconds: number;
  };
  discord: {
    enabled: boolean;
    webhook_url?: string;
  };
  automation: {
    auto_run_on_startup: boolean;
    scheduled_runs_enabled: boolean;
    scheduled_time: string; // Format: "HH:MM" (24-hour format)
  };
}

// Get settings
export function useSettings() {
  return useQuery<Settings>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        throw new Error("Failed to fetch settings");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Update settings
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: Partial<Settings>) => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || "Failed to update settings");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Saved",
        description: "Settings have been updated successfully.",
        duration: 3000,
      });
    },
    onError: (error: unknown) => {
      showErrorToast(error, "Failed to Save Settings");
    },
  });
}

// Test Discord notification
export function useTestDiscord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/discord/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        if (errorText.trim().startsWith("<!DOCTYPE") || errorText.trim().startsWith("<html")) {
          throw new Error("Backend server is not available");
        }
        const errorData = await res.json().catch(() => ({ error: errorText }));
        throw new Error(errorData.error || `Failed to test Discord: ${res.status} ${errorText}`);
      }
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Discord Test Successful",
        description: "Test notification sent to Discord successfully!",
        duration: 5000,
      });
    },
    onError: (error: unknown) => {
      showErrorToast(error, "Discord Test Failed");
    },
  });
}

export function useBackendHealth() {
  const query = useQuery<{ status: string; timestamp: string }>({
    queryKey: ["/api/health"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) {
          throw new Error("Backend is not healthy");
        }
        return res.json();
      } catch (error) {
        if (isNetworkError(error)) {
          throw new Error("Backend server is not available");
        }
        throw error;
      }
    },
    refetchInterval: 10000,
    retry: 1,
    retryDelay: 1000,
  });

  // Show toast on error (only once per error state)
  useEffect(() => {
    if (query.error && query.isError && !query.isFetching) {
      showErrorToast(query.error, "Backend Connection Lost");
    }
  }, [query.error, query.isError, query.isFetching]);

  return query;
}
