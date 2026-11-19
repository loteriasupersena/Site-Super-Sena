import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const node = process.execPath;
const port = process.env.PORT?.trim() || "3000";
const baseUrl = (process.env.INTERNAL_SCHEDULER_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, "");

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

const children = [];
let stopping = false;

function spawnChild(command, args) {
  const child = spawn(command, args, { stdio: "inherit", env: process.env });
  children.push(child);
  return child;
}

async function waitForNextReady(child) {
  const deadline = Date.now() + 90_000;
  let lastError = "servidor ainda não respondeu";
  console.info("[start-production] aguardando Next.js responder antes de iniciar o worker", { baseUrl });
  while (Date.now() < deadline && !stopping) {
    if (child.exitCode !== null) throw new Error(`Next.js encerrou antes de ficar pronto (code=${child.exitCode})`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_000);
    try {
      await fetch(baseUrl, { method: "GET", cache: "no-store", signal: controller.signal });
      clearTimeout(timeout);
      console.info("[start-production] Next.js está respondendo; iniciando worker interno", { baseUrl });
      return;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Next.js não ficou acessível em ${baseUrl} após 90 segundos: ${lastError}`);
}

const nextServer = spawnChild(npm, ["run", "start:next"]);
let workerStarted = false;

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

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => shutdown(0));
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

try {
  await waitForNextReady(nextServer);
  if (stopping) process.exit(1);
  const worker = spawnChild(node, ["scripts/internal-scheduler-worker.mjs"]);
  workerStarted = true;
  worker.once("error", (error) => {
    console.error("[start-production] worker interno falhou", error);
    shutdown(1);
  });
  worker.once("exit", (code, signal) => {
    if (!stopping) {
      console.error("[start-production] worker interno encerrou inesperadamente", { code, signal });
      shutdown(code === 0 ? 1 : code ?? 1);
    }
  });
} catch (error) {
  console.error("[start-production] inicialização dos serviços falhou", error);
  shutdown(1);
}
