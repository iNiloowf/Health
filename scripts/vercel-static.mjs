import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const route = path.join(root, "app", "api", "share", "route.ts");
const stashDir = path.join(root, ".vercel-api-stash");
const stash = path.join(stashDir, "route.ts");
const moved = existsSync(route);

rmSync(path.join(root, ".next", "dev"), { recursive: true, force: true });

if (moved) {
  mkdirSync(stashDir, { recursive: true });
  copyFileSync(route, stash);
  rmSync(route);
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
    mkdirSync(path.dirname(route), { recursive: true });
    copyFileSync(stash, route);
    rmSync(stash, { force: true });
  }
}

process.exit(status);
