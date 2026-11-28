"use client";

import { useCallback, useEffect, useState } from "react";

type Billing = {
  id: string;
  amountCents: number;
  status: "PENDING" | "PROCESSING";
  pixCopyPaste: string | null;
  pixQrCodeBase64: string | null;
  couponCount?: number;
  createdAt: string;
};
type Summary = {
  billing: Billing | null;
  outstanding: { couponCount: number; amountCents: number };
};

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function StoreBillingManager() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/store/billing", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível consultar o financeiro.");
      setSummary(body as Summary);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao consultar o financeiro.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createCharge() {
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/store/billing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível gerar a cobrança.");
      setNotice("Cobrança Pix preparada. A emissão de cupons e os sorteios continuam independentes do pagamento.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao gerar a cobrança Pix.");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function copyPixCode() {
    const code = summary?.billing?.pixCopyPaste;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setNotice("Código Pix copiado.");
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o código Pix e copie manualmente.");
    }
  }

  return (
    <section className="feature-card" aria-labelledby="store-billing-heading">
      <span className="feature-label">Financeiro da loja</span>
      <h2 id="store-billing-heading">Cobranças Pix da plataforma</h2>
      {loading && !summary ? <p>Consultando valores pendentes…</p> : summary ? (
        <>
          <div className="round-options">
            <article className="round-option"><strong>{summary.outstanding.couponCount}</strong><br />Cupons ainda não quitados</article>
            <article className="round-option"><strong>{money(summary.outstanding.amountCents)}</strong><br />Valor pendente</article>
          </div>
          {summary.billing ? (
            <div className="round-option">
              <h3>Cobrança Pix em aberto</h3>
              <p><strong>{money(summary.billing.amountCents)}</strong></p>
              <p>{summary.billing.couponCount ?? "—"} cupons incluídos nesta cobrança</p>
              <p>Situação: <strong>{summary.billing.status === "PENDING" ? "Aguardando pagamento" : "Em processamento"}</strong></p>
              {summary.billing.pixQrCodeBase64 && (
                <p><img
                  src={`data:image/png;base64,${summary.billing.pixQrCodeBase64}`}
                  alt="QR Code Pix para pagamento da cobrança da loja"
                  width={240}
                  height={240}
                  style={{ maxWidth: "100%", height: "auto", imageRendering: "pixelated" }}
                /></p>
              )}
              {summary.billing.pixCopyPaste && (
                <>
                  <label htmlFor="store-billing-pix-code">Pix copia e cola</label>
                  <textarea id="store-billing-pix-code" readOnly value={summary.billing.pixCopyPaste} rows={3} />
                  <button type="button" onClick={() => void copyPixCode()}>Copiar código Pix</button>
                </>
              )}
            </div>
          ) : (
            <p>Não há cobrança em aberto.</p>
          )}
          <p>A cobrança pode ser gerada antes de completar 100 cupons. O pagamento quita somente os cupons vinculados a ela. O sorteio global não depende da cobrança.</p>
          <div className="round-actions">
            <button type="button" onClick={() => void createCharge()} disabled={creating || loading || summary.outstanding.couponCount === 0}>
              {creating ? "Preparando cobrança…" : summary.billing ? "Consultar cobrança Pix" : "Gerar cobrança Pix"}
            </button>
            <button type="button" onClick={() => void load()} disabled={loading || creating}>Atualizar</button>
          </div>
        </>
      ) : null}
      <div className="form-feedback-slot" aria-live="polite">
        {error && <p role="alert" className="note-inline form-feedback-error">{error}</p>}
        {notice && <p role="status" className="note-inline form-feedback-success">{notice}</p>}
      </div>
    </section>
  );
}
