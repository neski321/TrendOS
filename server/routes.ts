import type { Express } from "express";
import { createServer, type Server } from "http";
import { pool } from "./db";
import dotenv from "dotenv";
import { resolve } from "path";
import fs from "fs";
import yaml from "js-yaml";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", async (_req, res) => {
    try {
      // Test database connection
      await pool.query("SELECT 1");
      res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        database: "connected"
      });
    } catch (error) {
      res.status(503).json({ 
        status: "error", 
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Trigger scan endpoint
  app.post("/api/scan/trigger", async (_req, res) => {
    try {
      // Check if a scan was already run today (completed or failed)
      const todayCheck = await pool.query(`
        SELECT 
          scan_id,
          status,
          started_at,
          completed_at
        FROM scan_status
        WHERE DATE(started_at) = CURRENT_DATE
          AND status IN ('completed', 'failed')
        ORDER BY started_at DESC
        LIMIT 1
      `);

      if (todayCheck.rows.length > 0) {
        const lastScan = todayCheck.rows[0];
        const scanTime = new Date(lastScan.started_at).toLocaleString();
        return res.status(429).json({
          success: false,
          error: "Only one scan per day is allowed",
          details: {
            lastScanTime: scanTime,
            lastScanStatus: lastScan.status,
            lastScanId: lastScan.scan_id,
            message: `A scan was already run today at ${scanTime}. Please wait 24 hours for API quotas to refresh before running another scan.`
          }
        });
      }

      // Also check if there's a scan currently running
      const runningCheck = await pool.query(`
        SELECT scan_id, started_at
        FROM scan_status
        WHERE status = 'running'
        ORDER BY started_at DESC
        LIMIT 1
      `);

      if (runningCheck.rows.length > 0) {
        const runningScan = runningCheck.rows[0];
        const scanTime = new Date(runningScan.started_at).toLocaleString();
        return res.status(409).json({
          success: false,
          error: "A scan is already running",
          details: {
            runningScanId: runningScan.scan_id,
            startedAt: scanTime,
            message: `A scan is currently running (started at ${scanTime}). Please wait for it to complete.`
          }
        });
      }

      const { spawn, execSync } = await import("child_process");
      const path = await import("path");
      const fs = await import("fs");
      
      // Check if Python script exists
      const backendDir = path.resolve(process.cwd(), "backend");
      const pythonScript = path.join(backendDir, "main.py");
      
      if (!fs.existsSync(pythonScript)) {
        console.error(`[SCAN] Python script not found at: ${pythonScript}`);
        return res.status(500).json({
          success: false,
          error: `Python scanner script not found at ${pythonScript}`
        });
      }
      
      // Find Python executable - simple approach like working Railway apps
      let pythonExec: string | null = null;
      
      // 1. Try to use the Python from the startup script (exported as PYTHON_EXECUTABLE)
      if (process.env.PYTHON_EXECUTABLE && fs.existsSync(process.env.PYTHON_EXECUTABLE)) {
        pythonExec = process.env.PYTHON_EXECUTABLE;
      }
      // 2. Try python3 command (Railway provides this)
      else {
        try {
          const python3Path = execSync("which python3", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
          if (python3Path && fs.existsSync(python3Path)) {
            pythonExec = python3Path;
          }
        } catch (e) {
          // python3 not in PATH
        }
      }
      
      // 3. Fallback to python command
      if (!pythonExec) {
        try {
          const pythonPath = execSync("which python", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
          if (pythonPath && fs.existsSync(pythonPath)) {
            pythonExec = pythonPath;
          }
        } catch (e) {
          // python not in PATH
        }
      }
      
      if (!pythonExec) {
        return res.status(500).json({
          success: false,
          error: "Failed to locate Python executable",
          details: {
            backendDir,
            scriptExists: fs.existsSync(pythonScript),
          }
        });
      }
      
      // Verify Python executable works
      try {
        const pythonVersion = execSync(`"${pythonExec}" --version`, { 
          encoding: "utf-8", 
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 5000 
        }).trim();
      } catch (e) {
        return res.status(500).json({
          success: false,
          error: `Python executable found but cannot be executed: ${pythonExec}`,
          details: {
            pythonExec,
            backendDir,
            scriptExists: fs.existsSync(pythonScript),
            error: e instanceof Error ? e.message : String(e),
          }
        });
      }
      
      // Spawn Python process matching scheduler._run_scan() behavior:
      // - detached process (like start_new_session=True)
      // - inherits environment from parent (no explicit env passing)
      // - stdout/stderr go to system logs (not captured by Node.js, but still visible in system logs)
      // Note: Python's logging writes to stderr, so we let it through to system logs
      // Database logs via DatabaseLogHandler still work regardless
      // Spawn Python process with LD_LIBRARY_PATH for numpy/pandas C extensions
      const pythonProcess = spawn(pythonExec, ["main.py"], {
        cwd: backendDir,
        env: {
          ...process.env,
          LD_LIBRARY_PATH: "/nix/store/*-gcc-*/lib:/nix/store/*-glibc-*/lib:" + (process.env.LD_LIBRARY_PATH || "")
        },
        stdio: "inherit", // Let stdout/stderr go to system logs (Railway/console will capture them)
        detached: true, // Detached process like start_new_session=True
      });
      
      // Unref the process so Node.js can exit independently (matches detached behavior)
      pythonProcess.unref();
      
      // Handle spawn errors (e.g., executable not found)
      pythonProcess.on("error", (error) => {
        console.error(`[SCAN] Error spawning Python process: ${error.message}`);
        // Note: This error handler may not be called if we already returned an error above
        // But it's here as a safety net
      });
      
      // Wait a moment to check if spawn failed immediately
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!pythonProcess.pid) {
        return res.status(500).json({
          success: false,
          error: "Failed to spawn Python process (no PID assigned)",
          details: {
            pythonExec,
            backendDir,
            scriptExists: fs.existsSync(pythonScript),
          }
        });
      }
      
      // Store process info for potential status checking
      const processId = pythonProcess.pid;
      
      // Get the scan_id from the Python process (it will create one)
      // We'll update it with the process ID after a short delay
      // For now, find the most recent pending/running scan and update it
      setTimeout(async () => {
        try {
          // Use a subquery to find the scan_id first, then update it
          await pool.query(`
            UPDATE scan_status
            SET progress_message = COALESCE(progress_message, '') || ' [PID: ' || $1 || ']'
            WHERE scan_id = (
              SELECT scan_id
              FROM scan_status
              WHERE status = 'running'
              ORDER BY started_at DESC
              LIMIT 1
            )
          `, [processId.toString()]);
        } catch (err) {
          console.error(`[SCAN] Error storing process ID: ${err}`);
        }
      }, 1000);
      
      // Return success immediately (don't wait for process to complete)
      // Note: We don't capture stdout/stderr or log exit codes to match scheduler._run_scan() behavior
      res.json({
        success: true,
        message: "Scan triggered successfully",
        timestamp: new Date().toISOString(),
        processId: processId,
        note: "Scan is running in the background. Check the dashboard for real-time progress."
      });
      
    } catch (error) {
      console.error("[SCAN] Error triggering scan:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Test Discord notification endpoint
  app.post("/api/discord/test", async (_req, res) => {
    try {
      // Load .env from root or backend directory (same as db.ts)
      dotenv.config({ path: resolve(process.cwd(), ".env") });
      dotenv.config({ path: resolve(process.cwd(), "backend", ".env") });
      
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      
      if (!webhookUrl || webhookUrl === "https://discord.com/api/webhooks/your_webhook_id/your_webhook_token") {
        return res.status(400).json({ 
          success: false,
          error: "Discord webhook URL not configured. Please set DISCORD_WEBHOOK_URL in your backend/.env file."
        });
      }

      // Import httpx dynamically (it's a Python library, but we can use Node's fetch)
      const testMessage = {
        content: `🧪 **TrendOS Test Notification**\n\nThis is a test message from TrendOS. If you're seeing this, your Discord webhook is configured correctly!\n\nTimestamp: ${new Date().toISOString()}`
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testMessage),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Discord API error: ${response.status} ${errorText}`);
      }

      res.json({ 
        success: true, 
        message: "Discord test notification sent successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error testing Discord notification:", error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get all video candidates
  app.get("/api/candidates", async (req, res) => {
    try {
      // Test database connection first
      await pool.query("SELECT 1");
      
      const { category, limit = "100", minScore = "0" } = req.query;
      
      let query = `
        SELECT 
          video_id as id,
          title,
          COALESCE(channel_title, channel_id) as "channel",
          published_at as "publishedAt",
          views,
          likes,
          duration_seconds as "durationSeconds",
          COALESCE(ROUND(views::numeric / NULLIF(EXTRACT(EPOCH FROM (NOW() - published_at)) / 3600, 0), 2), 0) as velocity,
          score,
          category,
          COALESCE(thumbnail_url, '') as thumbnail,
          entity,
          url
        FROM trending_videos
        WHERE score >= $1
      `;
      
      const params: any[] = [parseFloat(minScore as string)];
      
      if (category) {
        query += ` AND category = $2`;
        params.push(category);
      }
      
      query += ` ORDER BY score DESC, published_at DESC LIMIT $${params.length + 1}`;
      params.push(parseInt(limit as string));
      
      const result = await pool.query(query, params);
      
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching candidates:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("connect") || errorMessage.includes("ECONNREFUSED")) {
        res.status(503).json({ error: "Database connection failed. Please check your DATABASE_URL." });
      } else {
        res.status(500).json({ error: `Failed to fetch candidates: ${errorMessage}` });
      }
    }
  });

  // Get single candidate by ID with full details
  app.get("/api/candidates/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(`
        SELECT 
          video_id as id,
          title,
          COALESCE(channel_title, channel_id) as "channel",
          channel_id as "channelId",
          channel_title as "channelTitle",
          published_at as "publishedAt",
          views,
          likes,
          comments,
          duration_seconds as "durationSeconds",
          COALESCE(ROUND(views::numeric / NULLIF(EXTRACT(EPOCH FROM (NOW() - published_at)) / 3600, 0), 2), 0) as velocity,
          score,
          category,
          COALESCE(thumbnail_url, '') as thumbnail,
          entity,
          url,
          description,
          run_date as "runDate"
        FROM trending_videos
        WHERE video_id = $1
        LIMIT 1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Candidate not found" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error fetching candidate:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("connect") || errorMessage.includes("ECONNREFUSED")) {
        res.status(503).json({ error: "Database connection failed. Please check your DATABASE_URL." });
      } else {
        res.status(500).json({ error: `Failed to fetch candidate: ${errorMessage}` });
      }
    }
  });

  // Get dashboard metrics
  app.get("/api/metrics", async (req, res) => {
    try {
      // Test database connection first
      await pool.query("SELECT 1");
      // Total scanned (count of all videos)
      const totalScanned = await pool.query(
        `SELECT COUNT(*) as count FROM trending_videos`
      );
      
      // Average velocity (views per hour)
      const avgVelocity = await pool.query(`
        SELECT 
          COALESCE(AVG(views::numeric / NULLIF(EXTRACT(EPOCH FROM (NOW() - published_at)) / 3600, 0)), 0) as avg_velocity
        FROM trending_videos
        WHERE published_at > NOW() - INTERVAL '24 hours'
      `);
      
      // Active entities (distinct entities)
      const activeEntities = await pool.query(
        `SELECT COUNT(DISTINCT entity) as count FROM trending_videos`
      );
      
      // Clip candidates (score > 85)
      const clipCandidates = await pool.query(
        `SELECT COUNT(*) as count FROM trending_videos WHERE score > 85`
      );
      
      // Category counts
      const categoryCounts = await pool.query(`
        SELECT 
          category,
          COUNT(*) as count
        FROM trending_videos
        WHERE run_date = (SELECT MAX(run_date) FROM trending_videos)
        GROUP BY category
      `);
      
      // View velocity over 24 hours (hourly aggregates)
      const velocityData = await pool.query(`
        SELECT 
          DATE_TRUNC('hour', published_at) as hour,
          SUM(views) as views
        FROM trending_videos
        WHERE published_at > NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', published_at)
        ORDER BY hour
      `);
      
      res.json({
        totalScanned: parseInt(totalScanned.rows[0].count),
        avgVelocity: Math.round(parseFloat(avgVelocity.rows[0].avg_velocity) || 0),
        activeEntities: parseInt(activeEntities.rows[0].count),
        clipCandidates: parseInt(clipCandidates.rows[0].count),
        categoryCounts: categoryCounts.rows.map((row: any) => ({
          name: row.category === 'hip_hop' ? 'Hip Hop' : 
                row.category === 'nba' ? 'NBA' : 'Celeb',
          count: parseInt(row.count),
          color: row.category === 'hip_hop' ? '#00E599' :
                 row.category === 'nba' ? '#7000FF' : '#F59E0B'
        })),
        velocityData: velocityData.rows.map((row: any) => ({
          time: new Date(row.hour).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: false 
          }),
          views: parseInt(row.views) || 0
        }))
      });
    } catch (error) {
      console.error("Error fetching metrics:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("connect") || errorMessage.includes("ECONNREFUSED")) {
        res.status(503).json({ error: "Database connection failed. Please check your DATABASE_URL." });
      } else {
        res.status(500).json({ error: `Failed to fetch metrics: ${errorMessage}` });
      }
    }
  });

  // Get top picks (score > 90)
  app.get("/api/top-picks", async (req, res) => {
    try {
      const { limit = "4" } = req.query;
      
      const result = await pool.query(`
        SELECT 
          video_id as id,
          title,
          channel_id as "channel",
          published_at as "publishedAt",
          views,
          likes,
          duration_seconds as "durationSeconds",
          COALESCE(ROUND(views::numeric / NULLIF(EXTRACT(EPOCH FROM (NOW() - published_at)) / 3600, 0), 2), 0) as velocity,
          score,
          category,
          COALESCE(thumbnail_url, '') as thumbnail,
          entity,
          url
        FROM trending_videos
        WHERE score > 90
        ORDER BY score DESC, published_at DESC
        LIMIT $1
      `, [parseInt(limit as string)]);
      
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching top picks:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("connect") || errorMessage.includes("ECONNREFUSED")) {
        res.status(503).json({ error: "Database connection failed. Please check your DATABASE_URL." });
      } else {
        res.status(500).json({ error: `Failed to fetch top picks: ${errorMessage}` });
      }
    }
  });

  // Get system logs (from database or empty if no logs table exists)
  app.get("/api/logs", async (req, res) => {
    try {
      // Check if logs table exists, if not return empty array
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'system_logs'
        );
      `);
      
      if (tableCheck.rows[0].exists) {
        const result = await pool.query(`
          SELECT 
            id::text,
            timestamp::text,
            level,
            message,
            module
          FROM system_logs
          ORDER BY timestamp DESC
          LIMIT 100
        `);
        res.json(result.rows);
      } else {
        // No logs table yet, return empty array
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      // Return empty array on error rather than failing
      res.json([]);
    }
  });
  
  // Get scanner stats for feed page
  app.get("/api/scanner-stats", async (req, res) => {
    try {
      // Test database connection first
      await pool.query("SELECT 1");
      // Get scan rate (candidates added in last hour)
      const scanRate = await pool.query(`
        SELECT COUNT(*) as count
        FROM trending_videos
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `);
      
      // Get last 10 minutes count
      const last10m = await pool.query(`
        SELECT COUNT(*) as count
        FROM trending_videos
        WHERE created_at > NOW() - INTERVAL '10 minutes'
      `);
      
      // Get active entities (distinct entities from recent scans)
      const activeEntities = await pool.query(`
        SELECT DISTINCT entity
        FROM trending_videos
        WHERE run_date = (SELECT MAX(run_date) FROM trending_videos)
        LIMIT 10
      `);
      
      res.json({
        scanRate: parseFloat((parseInt(scanRate.rows[0].count) / 3600).toFixed(1)), // items per second
        last10m: parseInt(last10m.rows[0].count),
        activeEntities: activeEntities.rows.map((row: any) => row.entity),
      });
    } catch (error) {
      console.error("Error fetching scanner stats:", error);
      // Return empty stats on error rather than failing
      res.json({
        scanRate: 0,
        last10m: 0,
        activeEntities: [],
      });
    }
  });

  // Get recent runs
  app.get("/api/runs", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT DISTINCT run_date
        FROM trending_videos
        ORDER BY run_date DESC
        LIMIT 10
      `);
      
      res.json(result.rows.map((row: any) => row.run_date));
    } catch (error) {
      console.error("Error fetching runs:", error);
      res.status(500).json({ error: "Failed to fetch runs" });
    }
  });

  // Get settings configuration from database
  app.get("/api/settings", async (_req, res) => {
    try {
      // Check if app_settings table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'app_settings'
        )
      `);
      
      if (!tableCheck.rows[0].exists) {
        // Table doesn't exist, fallback to YAML
        try {
          const settingsPath = resolve(process.cwd(), "backend", "config", "settings.yaml");
          const settingsContent = fs.readFileSync(settingsPath, "utf-8");
          const yamlSettings = yaml.load(settingsContent) as any;
          res.json(yamlSettings);
          return;
        } catch (yamlError) {
          res.status(500).json({ 
            error: "Settings table not found and YAML fallback failed"
          });
          return;
        }
      }
      
      const result = await pool.query(`
        SELECT setting_key, setting_value 
        FROM app_settings
        ORDER BY setting_key
      `);
      
      // Convert rows to settings object (setting_value is already JSONB, so it's already an object)
      const settings: any = {};
      for (const row of result.rows) {
        settings[row.setting_key] = row.setting_value;
      }
      
      // If no settings exist, return defaults (fallback to YAML)
      if (Object.keys(settings).length === 0) {
        try {
          const settingsPath = resolve(process.cwd(), "backend", "config", "settings.yaml");
          const settingsContent = fs.readFileSync(settingsPath, "utf-8");
          const yamlSettings = yaml.load(settingsContent) as any;
          res.json(yamlSettings);
          return;
        } catch (yamlError) {
          // Return empty settings if YAML also fails
          res.json({});
          return;
        }
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error reading settings:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Update settings configuration in database
  app.post("/api/settings", async (req, res) => {
    try {
      // Check if app_settings table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'app_settings'
        )
      `);
      
      if (!tableCheck.rows[0].exists) {
        return res.status(500).json({ 
          success: false,
          error: "Settings table not found. Please run migrations first."
        });
      }
      
      const updates = req.body;
      
      // Update each setting group
      for (const [key, value] of Object.entries(updates)) {
        if (typeof value === 'object' && value !== null) {
          // PostgreSQL JSONB accepts JSON strings or objects directly
          await pool.query(`
            INSERT INTO app_settings (setting_key, setting_value, updated_at)
            VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
            ON CONFLICT (setting_key) 
            DO UPDATE SET 
              setting_value = EXCLUDED.setting_value,
              updated_at = CURRENT_TIMESTAMP
          `, [key, JSON.stringify(value)]);
        }
      }
      
      // Fetch updated settings
      const result = await pool.query(`
        SELECT setting_key, setting_value 
        FROM app_settings
        ORDER BY setting_key
      `);
      
      const settings: any = {};
      for (const row of result.rows) {
        settings[row.setting_key] = row.setting_value;
      }
      
      res.json({ 
        success: true, 
        message: "Settings updated successfully",
        settings: settings
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get entities configuration from database
  app.get("/api/entities", async (_req, res) => {
    try {
      // Check if app_settings table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'app_settings'
        )
      `);
      
      if (!tableCheck.rows[0].exists) {
        // Table doesn't exist, fallback to YAML
        try {
          const entitiesPath = resolve(process.cwd(), "backend", "config", "entities.yaml");
          const entitiesContent = fs.readFileSync(entitiesPath, "utf-8");
          const yamlEntities = yaml.load(entitiesContent) as any;
          res.json(yamlEntities);
          return;
        } catch (yamlError) {
          res.status(500).json({ 
            error: "Entities table not found and YAML fallback failed"
          });
          return;
        }
      }
      
      const result = await pool.query(`
        SELECT setting_value 
        FROM app_settings
        WHERE setting_key = 'entities'
      `);
      
      if (result.rows.length === 0) {
        // No entities in database, fallback to YAML and save to database
        try {
          const entitiesPath = resolve(process.cwd(), "backend", "config", "entities.yaml");
          const entitiesContent = fs.readFileSync(entitiesPath, "utf-8");
          const yamlEntities = yaml.load(entitiesContent) as any;
          
          // Save to database for future use
          try {
            await pool.query(`
              INSERT INTO app_settings (setting_key, setting_value, description, updated_at)
              VALUES ($1, $2::jsonb, 'Entity management configuration (categories, entities, channels, keywords)', CURRENT_TIMESTAMP)
              ON CONFLICT (setting_key) 
              DO UPDATE SET 
                setting_value = EXCLUDED.setting_value,
                updated_at = CURRENT_TIMESTAMP
            `, ['entities', JSON.stringify(yamlEntities)]);
          } catch (saveError) {
            // Silently fail - database save is not critical, YAML entities will still be returned
          }
          
          res.json(yamlEntities);
          return;
        } catch (yamlError) {
          res.json({});
          return;
        }
      }
      
      res.json(result.rows[0].setting_value);
    } catch (error) {
      console.error("Error reading entities:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Update entities configuration in database
  app.post("/api/entities", async (req, res) => {
    try {
      // Check if app_settings table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'app_settings'
        )
      `);
      
      if (!tableCheck.rows[0].exists) {
        return res.status(500).json({ 
          success: false,
          error: "Settings table not found. Please run migrations first."
        });
      }
      
      const entities = req.body;
      
      // Validate structure
      if (!entities.categories || typeof entities.categories !== 'object') {
        return res.status(400).json({ 
          success: false,
          error: "Invalid entities structure: 'categories' is required"
        });
      }
      
      // Update entities in database
      await pool.query(`
        INSERT INTO app_settings (setting_key, setting_value, updated_at)
        VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (setting_key) 
        DO UPDATE SET 
          setting_value = EXCLUDED.setting_value,
          updated_at = CURRENT_TIMESTAMP
      `, ['entities', JSON.stringify(entities)]);
      
      // Fetch updated entities
      const result = await pool.query(`
        SELECT setting_value 
        FROM app_settings
        WHERE setting_key = 'entities'
      `);
      
      res.json({ 
        success: true, 
        message: "Entities updated successfully",
        entities: result.rows[0].setting_value
      });
    } catch (error) {
      console.error("Error updating entities:", error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get current scan status
  app.get("/api/scan/status", async (_req, res) => {
    try {
      // First, check for stale scans (running for more than 2 hours) and mark them as failed
      await pool.query(`
        UPDATE scan_status
        SET status = 'failed',
            completed_at = CURRENT_TIMESTAMP,
            error_message = 'Scan timed out - process may have crashed or been interrupted',
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'running'
          AND started_at < NOW() - INTERVAL '2 hours'
      `);

      const result = await pool.query(`
        SELECT 
          scan_id,
          status,
          started_at,
          completed_at,
          error_message,
          progress_message,
          candidates_found,
          candidates_saved,
          created_at,
          updated_at
        FROM scan_status
        WHERE status = 'running'
        ORDER BY started_at DESC
        LIMIT 1
      `);

      if (result.rows.length > 0) {
        res.json({
          isRunning: true,
          scan: result.rows[0],
        });
      } else {
        // Check for most recent scan (completed or failed)
        const recentResult = await pool.query(`
          SELECT 
            scan_id,
            status,
            started_at,
            completed_at,
            error_message,
            progress_message,
            candidates_found,
            candidates_saved,
            created_at,
            updated_at
          FROM scan_status
          ORDER BY started_at DESC
          LIMIT 1
        `);

        res.json({
          isRunning: false,
          scan: recentResult.rows.length > 0 ? recentResult.rows[0] : null,
        });
      }
    } catch (error) {
      console.error("Error getting scan status:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Terminate a running scan
  app.post("/api/scan/terminate", async (req, res) => {
    try {
      const { scanId } = req.body;
      
      if (!scanId) {
        return res.status(400).json({
          success: false,
          error: "scanId is required"
        });
      }

      // Find the running scan
      const scanResult = await pool.query(`
        SELECT scan_id, status, progress_message
        FROM scan_status
        WHERE scan_id = $1 AND status = 'running'
        LIMIT 1
      `, [scanId]);

      if (scanResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No running scan found with the provided scanId"
        });
      }

      const scan = scanResult.rows[0];
      
      // Extract PID from progress_message if available (format: "message [PID: 12345]")
      let processId: number | null = null;
      const pidMatch = scan.progress_message?.match(/\[PID: (\d+)\]/);
      if (pidMatch) {
        processId = parseInt(pidMatch[1], 10);
      }

      // Try to kill the process
      let killSuccess = false;
      if (processId) {
        try {
          // Try graceful termination first (SIGTERM)
          try {
            process.kill(processId, 'SIGTERM');
            // Wait a bit to see if process terminates
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Check if process is still alive (on Unix systems)
            try {
              process.kill(processId, 0); // Signal 0 checks if process exists
              // Process still exists, try SIGKILL
              process.kill(processId, 'SIGKILL');
            } catch (checkErr) {
              // Process doesn't exist (good, it terminated)
            }
            killSuccess = true;
          } catch (err) {
            // Process might not exist or we don't have permission
            console.error(`[SCAN] Failed to kill process ${processId}: ${err}`);
            // Try SIGKILL as fallback
            try {
              process.kill(processId, 'SIGKILL');
              killSuccess = true;
            } catch (killErr) {
              console.error(`[SCAN] SIGKILL also failed: ${killErr}`);
            }
          }
        } catch (err) {
          console.error(`[SCAN] Error attempting to kill process: ${err}`);
        }
      } else {
        // If no PID found, try to find and kill Python processes running main.py
        try {
          const { execSync } = await import("child_process");
          const path = await import("path");
          const backendDir = path.resolve(process.cwd(), "backend");
          const pythonScript = path.join(backendDir, "main.py");
          
          // Find processes running main.py
          try {
            if (process.platform === 'win32') {
              // Windows: tasklist and taskkill
              execSync(`taskkill /F /FI "WINDOWTITLE eq *main.py*"`, { stdio: 'ignore' });
            } else {
              // Unix/Linux/Mac: pkill or killall
              execSync(`pkill -f "python.*main.py"`, { stdio: 'ignore' });
            }
            killSuccess = true;
          } catch (pkillErr) {
            console.error(`[SCAN] Failed to kill processes: ${pkillErr}`);
          }
        } catch (err) {
          console.error(`[SCAN] Error finding processes: ${err}`);
        }
      }

      // Mark scan as cancelled in database
      await pool.query(`
        UPDATE scan_status
        SET status = 'cancelled',
            completed_at = CURRENT_TIMESTAMP,
            error_message = 'Scan terminated by user' || CASE WHEN $1 THEN ' (process killed)' ELSE '' END,
            updated_at = CURRENT_TIMESTAMP
        WHERE scan_id = $2
      `, [killSuccess, scanId]);

      res.json({
        success: true,
        message: killSuccess 
          ? "Scan terminated successfully" 
          : "Scan marked as cancelled (process may still be running)",
        scanId: scanId,
        processKilled: killSuccess
      });
    } catch (error) {
      console.error("[SCAN] Error terminating scan:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get recent scans
  app.get("/api/scan/history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await pool.query(`
        SELECT 
          scan_id,
          status,
          started_at,
          completed_at,
          error_message,
          progress_message,
          candidates_found,
          candidates_saved,
          created_at,
          updated_at
        FROM scan_status
        ORDER BY started_at DESC
        LIMIT $1
      `, [limit]);

      res.json(result.rows);
    } catch (error) {
      console.error("Error getting scan history:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get API quota usage (aggregate across all keys)
  app.get("/api/quota/usage", async (_req, res) => {
    try {
      // First check if quota_tracking table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'quota_tracking'
        )
      `);
      
      if (!tableCheck.rows[0].exists) {
        // Table doesn't exist yet, return defaults
        return res.json({
          used: 0,
          limit: 10000,
          remaining: 10000,
          percentage: 0,
        });
      }

      // Check if api_key_hash column exists
      const columnCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'quota_tracking' AND column_name = 'api_key_hash'
        )
      `);
      
      const hasApiKeyHash = columnCheck.rows[0].exists;
      
      // Build query based on whether api_key_hash column exists
      let query: string;
      if (hasApiKeyHash) {
        query = `
          SELECT 
            COALESCE(SUM(quota_used), 0) as total_used,
            COALESCE(SUM(quota_limit), 0) as total_limit,
            COUNT(DISTINCT api_key_hash) as key_count
          FROM quota_tracking
          WHERE date = CURRENT_DATE
        `;
      } else {
        // Fallback for older schema without api_key_hash
        query = `
          SELECT 
            COALESCE(SUM(quota_used), 0) as total_used,
            COALESCE(SUM(quota_limit), 0) as total_limit,
            COUNT(*) as key_count
          FROM quota_tracking
          WHERE date = CURRENT_DATE
        `;
      }

      const result = await pool.query(query);

      const totalUsed = parseInt(result.rows[0]?.total_used || "0");
      const totalLimit = parseInt(result.rows[0]?.total_limit || "0");
      const keyCount = parseInt(result.rows[0]?.key_count || "0");
      
      // If no quota tracking exists yet, default to 10,000 per key (estimate 1 key)
      const defaultLimitPerKey = 10000;
      const estimatedKeys = keyCount > 0 ? keyCount : 1;
      const finalLimit = totalLimit > 0 ? totalLimit : (estimatedKeys * defaultLimitPerKey);
      const percentage = finalLimit > 0 ? Math.round((totalUsed / finalLimit) * 100) : 0;

      res.json({
        used: totalUsed,
        limit: finalLimit,
        remaining: finalLimit - totalUsed,
        percentage: Math.min(percentage, 100), // Cap at 100%
      });
    } catch (error) {
      console.error("Error getting quota usage:", error);
      // Return default values on error
      res.json({
        used: 0,
        limit: 10000,
        remaining: 10000,
        percentage: 0,
      });
    }
  });

  return httpServer;
}
