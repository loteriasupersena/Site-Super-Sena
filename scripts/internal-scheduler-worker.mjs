const port = process.env.PORT?.trim() || "3000";
const baseUrl = (process.env.INTERNAL_SCHEDULER_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, "");
const intervalMs = 60_000;
const retryMs = 15_000;
const maxFetchAttempts = 3;

const jobs = [
  { name: "mercadopago-payment-reconciliation", path: "/api/internal/mercadopago/payments/reconcile", token: process.env.MERCADOPAGO_RECONCILIATION_TOKEN?.trim() },
  { name: "round-scheduler", path: "/api/internal/round-scheduler", token: process.env.ROUND_SCHEDULER_SECRET?.trim() },
];

const enabledJobs = jobs.filter((job) => {
  if (job.token && job.token.length >= 32) return true;
  const message = `[internal-scheduler-worker] ${job.name}: segredo ausente ou menor que 32 caracteres.`;
  // Do not take the whole site offline when the new Mercado Pago secret has
  // not yet been configured during deployment. Round scheduling remains
  // mandatory; payment reconciliation can be enabled as soon as its secret exists.
  if (job.name === "round-scheduler") {
    console.error(message);
    process.exit(1);
  }
  console.warn(message + " Rotina desativada até a configuração do segredo.");
  return false;
});

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { stopping = true; });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function describeError(error) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (cause && typeof cause === "object") {
    const detail = [cause.code, cause.errno, cause.syscall, cause.address, cause.port].filter(Boolean).join(" ");
    if (detail) return `${error.message} (${detail})`;
  }
  return error.message;
}

async function runJob(job) {
  let lastError;
  for (let attempt = 1; attempt <= maxFetchAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(`${baseUrl}${job.path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${job.token}`, "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${body.error || "falha na rotina"}`);
        if (response.status < 500 || attempt === maxFetchAttempts) throw error;
        lastError = error;
      } else {
        console.info(`[internal-scheduler-worker] ${job.name} concluído`, {
          success: body.success ?? body.ok ?? true,
          checked: body.checked ?? body.pixChecked ?? 0,
          recovered: body.recovered ?? 0,
          confirmed: body.confirmed ?? body.pixConfirmed ?? 0,
          errors: body.errors ?? body.failures ?? 0,
        });
        return;
      }
    } catch (error) {
      lastError = error;
      if (attempt === maxFetchAttempts || (error instanceof Error && /^HTTP 4\d\d:/.test(error.message))) break;
    } finally {
      clearTimeout(timeout);
    }
    console.warn(`[internal-scheduler-worker] ${job.name}: falha de comunicação; nova tentativa ${attempt}/${maxFetchAttempts}`, {
      error: describeError(lastError),
    });
    await sleep(1_000 * attempt);
  }
  throw lastError ?? new Error("Falha de comunicação sem detalhe.");
}

async function loop(job) {
  while (!stopping) {
    const startedAt = Date.now();
    try {
      await runJob(job);
    } catch (error) {
      console.error(`[internal-scheduler-worker] ${job.name} falhou; haverá nova tentativa`, {
        error: describeError(error),
      });
    }
    const elapsed = Date.now() - startedAt;
    await sleep(Math.max(1_000, elapsed >= intervalMs ? retryMs : intervalMs - elapsed));
  }
}

console.info("[internal-scheduler-worker] iniciado", {
  baseUrl,
  jobs: enabledJobs.map(({ name, path }) => ({ name, path })),
  intervalMs,
  maxFetchAttempts,
});
await Promise.all(enabledJobs.map(loop));
console.info("[internal-scheduler-worker] encerrado");
