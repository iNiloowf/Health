import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiDir = path.join(root, "app", "api");
const stash = path.join(root, ".vercel-api-stash", "api");
const moved = existsSync(apiDir);

rmSync(path.join(root, ".next", "dev"), { recursive: true, force: true });

if (moved) {
  rmSync(stash, { recursive: true, force: true });
  mkdirSync(path.dirname(stash), { recursive: true });
  cpSync(apiDir, stash, { recursive: true });
  rmSync(apiDir, { recursive: true, force: true });
}

let status = 1;
try {
  const result = spawnSync(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "build"], {
    stdio: "inherit",
    env: { ...process.env, VERCEL: "1" },
    cwd: root,
  });
  status = result.status ?? 1;
} finally {
  if (moved && existsSync(stash)) {
    mkdirSync(apiDir, { recursive: true });
    cpSync(stash, apiDir, { recursive: true });
    rmSync(stash, { recursive: true, force: true });
  }
}

process.exit(status);
