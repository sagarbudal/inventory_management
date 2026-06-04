import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distIndex = join(root, "dist", "index.js");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process exited with code ${code}`));
    });
  });
}

if (existsSync(distIndex)) {
  await run(process.execPath, [distIndex]);
} else {
  console.warn(
    "[Backend] dist/index.js not found — starting with tsx. Set Render Build Command to: npm run render-build"
  );
  const tsxCli = join(root, "node_modules", "tsx", "dist", "cli.mjs");
  await run(process.execPath, [tsxCli, join(root, "src", "index.ts")]);
}
