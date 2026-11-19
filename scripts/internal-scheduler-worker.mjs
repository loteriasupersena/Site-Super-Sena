const port = process.env.PORT?.trim() || "3000";
const baseUrl = (process.env.INTERNAL_SCHEDULER_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, "");
const intervalMs = 60_000;
const retryMs = 15_000;

const jobs = [
  {
    name: "asaas-payment-reconciliation",
    path: "/api/internal/asaas/payments/reconcile",
    token: process.env.ASAAS_RECONCILIATION_TOKEN?.trim(),
  },
  {
    name: "asaas-transfer-reconciliation",
    path: "/api/internal/asaas/transfers/reconcile",
    token: process.env.ASAAS_RECONCILIATION_TOKEN?.trim(),
  },
  {
    name: "round-scheduler",
    path: "/api/internal/round-scheduler",
    token: process.env.ROUND_SCHEDULER_SECRET?.trim(),
  },
];

for (const job of jobs) {
  if (!job.token || job.token.length < 32) {
    console.error(`[internal-scheduler-worker] ${job.name}: segredo ausente ou menor que 32 caracteres.`);
    process.exit(1);
  }
}

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { stopping = true; });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runJob(job) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${baseUrl}${job.path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${job.token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.error || "falha na rotina"}`);
    console.info(`[internal-scheduler-worker] ${job.name} concluído`, {
      success: body.success ?? body.ok ?? true,
      checked: body.checked ?? body.pixChecked ?? 0,
      recovered: body.recovered ?? 0,
      confirmed: body.confirmed ?? body.pixConfirmed ?? 0,
      errors: body.errors ?? body.failures ?? 0,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function loop(job) {
  while (!stopping) {
    const startedAt = Date.now();
    try {
      await runJob(job);
    } catch (error) {
      console.error(`[internal-scheduler-worker] ${job.name} falhou; haverá nova tentativa`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    const elapsed = Date.now() - startedAt;
    await sleep(Math.max(1_000, elapsed >= intervalMs ? retryMs : intervalMs - elapsed));
  }
}

console.info("[internal-scheduler-worker] iniciado", {
  baseUrl,
  jobs: jobs.map(({ name, path }) => ({ name, path })),
  intervalMs,
});
await Promise.all(jobs.map(loop));
console.info("[internal-scheduler-worker] encerrado");
