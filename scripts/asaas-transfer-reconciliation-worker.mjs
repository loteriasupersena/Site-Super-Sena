const token = process.env.ASAAS_RECONCILIATION_TOKEN?.trim();
const port = process.env.PORT?.trim() || "3000";
const baseUrl = (process.env.ASAAS_RECONCILIATION_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, "");
const intervalMs = 60_000;
const retryMs = 15_000;

if (!token || token.length < 32) {
  console.error("[asaas-reconciliation-worker] ASAAS_RECONCILIATION_TOKEN precisa ter pelo menos 32 caracteres.");
  process.exit(1);
}

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { stopping = true; });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function reconcile() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${baseUrl}/api/internal/asaas/transfers/reconcile`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.error || "falha na conciliação"}`);
    console.info("[asaas-reconciliation-worker] ciclo concluído", {
      checked: body.checked ?? 0,
      recovered: body.recovered ?? 0,
      confirmed: body.confirmed ?? 0,
      pending: body.pending ?? 0,
      ambiguous: body.ambiguous ?? 0,
      errors: body.errors ?? 0,
    });
  } finally {
    clearTimeout(timeout);
  }
}

console.info("[asaas-reconciliation-worker] iniciado", { baseUrl, intervalMs });
while (!stopping) {
  const startedAt = Date.now();
  try {
    await reconcile();
  } catch (error) {
    console.error("[asaas-reconciliation-worker] ciclo falhou; nova tentativa será feita", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const elapsed = Date.now() - startedAt;
  await sleep(Math.max(1_000, (elapsed >= intervalMs ? retryMs : intervalMs - elapsed)));
}
console.info("[asaas-reconciliation-worker] encerrado");
