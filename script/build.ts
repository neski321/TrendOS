import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  try {
    console.log("[BUILD] Cleaning dist directory...");
    await rm("dist", { recursive: true, force: true });

    console.log("[BUILD] Building client (Vite)...");
    await viteBuild();
    console.log("[BUILD] Client build completed");

    console.log("[BUILD] Building server (esbuild)...");
    const pkg = JSON.parse(await readFile("package.json", "utf-8"));
    const allDeps = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ];
    const externals = allDeps.filter((dep) => !allowlist.includes(dep));

    await esbuild({
      entryPoints: ["server/index.ts"],
      platform: "node",
      bundle: true,
      format: "cjs",
      outfile: "dist/index.cjs",
      define: {
        "process.env.NODE_ENV": '"production"',
      },
      minify: true,
      external: externals,
      logLevel: "info",
    });
    console.log("[BUILD] Server build completed");

    // Verify files were created
    const fs = await import("fs");
    if (!fs.existsSync("dist/index.cjs")) {
      throw new Error("dist/index.cjs was not created!");
    }
    if (!fs.existsSync("dist/public")) {
      throw new Error("dist/public was not created!");
    }
    console.log("[BUILD] Build verification: All files created successfully");
  } catch (error) {
    console.error("[BUILD] Build failed:", error);
    throw error;
  }
}

buildAll().catch((err) => {
  console.error("[BUILD] Fatal build error:", err);
  process.exit(1);
});
