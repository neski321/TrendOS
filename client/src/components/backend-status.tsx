import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useBackendHealth } from "@/lib/api";

export function BackendStatus() {
  const { data, error, isLoading } = useBackendHealth();

  if (isLoading) {
    return (
      <Alert className="border-border">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Checking Backend Status</AlertTitle>
        <AlertDescription>
          Verifying connection to backend server...
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-500/50">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Backend Unavailable</AlertTitle>
        <AlertDescription>
          Cannot connect to the backend server. Please ensure the server is running.
          <br />
          <span className="text-xs mt-1 block">
            Error: {error instanceof Error ? error.message : "Unknown error"}
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  if (data?.status === "ok") {
    return (
      <Alert className="border-green-500/50 bg-green-500/10">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <AlertTitle className="text-green-500">Backend Connected</AlertTitle>
        <AlertDescription className="text-green-500/80">
          Backend server is running and responding.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}





