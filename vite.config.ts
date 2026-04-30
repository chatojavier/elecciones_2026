import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const execFileAsync = promisify(execFile);

export default defineConfig({
  plugins: [
    react(),
    {
      name: "dev-refresh-snapshot",
      configureServer(server) {
        server.middlewares.use("/api/refresh-snapshot", async (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
            return;
          }

          try {
            await execFileAsync("node", ["scripts/generate-dev-snapshot.mjs"], {
              cwd: server.config.root
            });
            const snapshotPath = resolve(
              server.config.root,
              process.env.DEV_SNAPSHOT_OUTPUT_PATH ?? "public/dev-snapshot.json"
            );
            const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, state: "synced", snapshot }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                error: (error as Error).message
              })
            );
          }
        });
      }
    }
  ]
});
