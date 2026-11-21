"use client";

import { useCallback, useEffect, useState } from "react";

type Winner = {
  id: string;
  prizeCents: number;
  prizeCategoryLabel: string | null;
  calculationConsistent: boolean;
  roundCode: string;
  receiptCode: string | null;
  playerName: string;
  paid: boolean;
  paymentRequest: {
    status: "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED" | "CANCELLED";
    netCents: number;
    pixKey: string | null;
    pixKeyMasked: string;
    pixKeyType: string | null;
  } | null;
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(cents / 100);

export function AdminPrizePayout() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/prizes/pending", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Falha ao carregar solicitações.");
      setWinners(body.winners as Winner[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar solicitações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, 10_000);
    return () => { window.clearTimeout(timer); window.clearInterval(poll); };
  }, [load]);

  async function copyPixKey(winner: Winner) {
    const key = winner.paymentRequest?.pixKey;
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(winner.id);
      window.setTimeout(() => setCopied((current) => current === winner.id ? null : current), 1800);
    } catch {
      setError("Não foi possível copiar a chave Pix.");
    }
  }

  async function confirmPaid(winner: Winner) {
    if (!winner.paymentRequest || !window.confirm("Confirma que o Pix de " + money(winner.paymentRequest.netCents) + " foi transferido e conferido no banco?")) return;
    setBusy(winner.id);
    setError("");
    try {
      const response = await fetch("/api/admin/prizes/" + encodeURIComponent(winner.id) + "/payout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível registrar o pagamento.");
      setWinners((current) => current.filter((item) => item.id !== winner.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao confirmar pagamento.");
    } finally {
      setBusy(null);
    }
  }

  const pending = winners.filter((winner) =>
    !winner.paid &&
    winner.paymentRequest !== null &&
    ["PENDING", "PROCESSING"].includes(winner.paymentRequest.status)
  );

  return <section className="feature-card admin-prize-payout" aria-labelledby="admin-prize-payout-heading">
    <h2 id="admin-prize-payout-heading">Solicitações ({pending.length})</h2>
    {error && <p role="alert" className="note-inline">{error}</p>}
    {loading ? <p>Carregando…</p> : pending.length === 0
      ? <p>Nenhuma solicitação pendente.</p>
      : <div className="admin-round-list">
        {pending.map((winner) => <article className="round-option admin-prize-card" key={winner.id}>
          <div className="admin-payment-card-heading">
            <strong>{money(winner.paymentRequest!.netCents)}</strong>
          </div>
          <p><span className="admin-payment-status">{winner.paymentRequest!.status === "PROCESSING" ? "EM PROCESSAMENTO" : "AGUARDANDO"}</span>{winner.receiptCode && <> · {winner.receiptCode}</>}</p>
          <p className="admin-payment-pix">Pix: <strong>{winner.paymentRequest!.pixKey ?? winner.paymentRequest!.pixKeyMasked}</strong></p>
          {!winner.calculationConsistent && <p role="alert">Conferência necessária. Pagamento bloqueado.</p>}
          <div className="admin-payment-actions">
            <button type="button" className="secondary-button" disabled={!winner.paymentRequest!.pixKey} onClick={() => void copyPixKey(winner)}>
              {copied === winner.id ? "Copiado" : "Copiar"}
            </button>
            <button type="button" disabled={busy !== null || !winner.calculationConsistent} onClick={() => void confirmPaid(winner)}>
              {busy === winner.id ? "Salvando…" : "Confirmar"}
            </button>
          </div>
        </article>)}
      </div>}
    <button type="button" className="secondary-button admin-payment-refresh" disabled={loading} onClick={() => { setLoading(true); setError(""); void load(); }}>Atualizar</button>
  </section>;
}
