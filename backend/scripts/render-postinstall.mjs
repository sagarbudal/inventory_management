import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

/** After `npm install` on Render, compile TypeScript → dist/ */
if (process.env.RENDER !== "true") {
  process.exit(0);
}

if (existsSync("dist/index.js")) {
  console.log("[Backend] dist/index.js already exists — skipping build.");
  process.exit(0);
}

try {
  console.log("[Backend] Render detected — installing devDependencies and compiling TypeScript...");
  execSync("npm install --include=dev", { stdio: "inherit" });
  execSync("npm run build", { stdio: "inherit" });
  console.log("[Backend] Build complete — dist/index.js ready.");
} catch (err) {
  console.warn(
    "[Backend] TypeScript build failed; npm start will use tsx fallback.",
    err instanceof Error ? err.message : err
  );
}
