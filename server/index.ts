import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Only log errors (4xx, 5xx status codes)
      const isError = res.statusCode >= 400;
      
      if (!isError) {
        return; // Skip all successful requests - no console noise
      }
      
      // Only log errors with minimal information
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      if (capturedJsonResponse) {
        const jsonString = JSON.stringify(capturedJsonResponse);
        const jsonSize = jsonString.length;
        
        // For errors, show the full response if it's small, otherwise summarize
        if (jsonSize > 200) {
          logLine += ` :: {Error response: ${jsonSize} bytes}`;
        } else {
          logLine += ` :: ${jsonString}`;
        }
      }
      
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "production") {
      log("Production mode: serving static files");
      serveStatic(app);
    } else {
      log("Development mode: Setting up Vite development server...");
      try {
        const { setupVite } = await import("./vite");
        await setupVite(httpServer, app);
        log("Vite development server ready");
      } catch (viteError) {
        log(`Failed to setup Vite: ${viteError instanceof Error ? viteError.message : "Unknown error"}`, "ERROR");
        console.error("[VITE] Setup error:", viteError);
        // Fallback to static files if Vite fails
        log("Falling back to static file serving...");
        serveStatic(app);
      }
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 4070 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = process.env.PORT ? parseInt(process.env.PORT) : 4070;
    
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        //reusePort: true,
      },
      () => {
        log(`serving on port ${port}`);
        log(`Server ready at http://0.0.0.0:${port}`);
        log(`NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
        log(`Server is listening and ready to accept connections`);
      },
    );

    // Handle server errors
    httpServer.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        log(`Port ${port} is already in use. Please free the port or use a different one.`, "ERROR");
        process.exit(1);
      } else {
        log(`Server error: ${err.message}`, "ERROR");
        throw err;
      }
    });
  } catch (error) {
    log(`Failed to start server: ${error instanceof Error ? error.message : "Unknown error"}`, "ERROR");
    console.error(error);
    process.exit(1);
  }
})();
