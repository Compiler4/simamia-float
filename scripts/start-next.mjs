import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = process.env.PORT || "3000";

const child = spawn(
  process.execPath,
  [nextCli, "start", "--hostname", hostname, "--port", port],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
