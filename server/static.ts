import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // In production build, static files are in dist/public
  // __dirname points to the compiled location (dist/server or dist)
  const distPath = path.resolve(__dirname, "..", "dist", "public");
  
  console.log(`[STATIC] Looking for static files at: ${distPath}`);
  console.log(`[STATIC] __dirname is: ${__dirname}`);
  
  if (!fs.existsSync(distPath)) {
    // Try alternative path
    const altPath = path.resolve(__dirname, "public");
    console.log(`[STATIC] Trying alternative path: ${altPath}`);
    if (fs.existsSync(altPath)) {
      console.log(`[STATIC] Using alternative path: ${altPath}`);
      app.use(express.static(altPath));
      app.use("*", (_req, res) => {
        res.sendFile(path.resolve(altPath, "index.html"));
      });
      return;
    }
    throw new Error(
      `Could not find the build directory. Tried: ${distPath} and ${altPath}. Make sure to build the client first with 'npm run build'`,
    );
  }

  console.log(`[STATIC] Serving static files from: ${distPath}`);
  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    console.log(`[STATIC] Serving index.html from: ${indexPath}`);
    res.sendFile(indexPath);
  });
}
