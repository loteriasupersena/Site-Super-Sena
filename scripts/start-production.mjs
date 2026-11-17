import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const node = process.execPath;

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} encerrou (code=${code}, signal=${signal})`));
    });
  });
}

await run(npm, ["run", "db:deploy"], "Prisma migrations");
await run(npm, ["run", "admin:provision"], "Admin provisioning");

const children = [
  spawn(npm, ["run", "start:next"], { stdio: "inherit", env: process.env }),
  spawn(node, ["scripts/internal-scheduler-worker.mjs"], { stdio: "inherit", env: process.env }),
];
let stopping = false;

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
    }
    process.exit(code);
  }, 10_000).unref();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}
for (const child of children) {
  child.once("error", (error) => {
    console.error("[start-production] processo filho falhou", error);
    shutdown(1);
  });
  child.once("exit", (code, signal) => {
    if (!stopping) {
      console.error("[start-production] processo filho encerrou inesperadamente", { code, signal });
      shutdown(code === 0 ? 1 : code ?? 1);
    }
  });
}
