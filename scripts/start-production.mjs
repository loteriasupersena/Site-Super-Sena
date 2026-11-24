import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const child = spawn(npm, ["run", "start:next"], {
  stdio: "inherit",
  env: process.env,
});

function stop(signal) {
  if (child.exitCode === null && !child.killed) child.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stop(signal));
}

child.once("error", (error) => {
  console.error("[start-production] não foi possível iniciar o Next.js", error);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
