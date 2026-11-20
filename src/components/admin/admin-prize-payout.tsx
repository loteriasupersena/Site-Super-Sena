"use client";

import { useCallback, useEffect, useState } from "react";

type Winner = {
  id: string;
  numberValue: string;
  prizeCents: number;
  stakeCents: number;
  prizeCategory: string | null;
  prizeCategoryLabel: string | null;
  categoryStakeCents: number | null;
  multiplier: number | null;
  calculatedPrizeCents: number | null;
  calculationConsistent: boolean;
  participationTotalCents: number;
  purchaseTotalCents: number;
  roundCode: string;
  resultNumber: string | null;
  resultAt: string;
  receiptCode: string | null;
  playerName: string;
  phone: string | null;
  cashierName: string | null;
  physicalReceiptEligible: boolean;
  paid: boolean;
  payoutChannel: "PLATFORM_PIX" | "CASHIER_CASH" | "WALLET" | null;
  paidAt: string | null;
  reference: string | null;
  paymentRequest: { id: string; status: "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED" | "CANCELLED"; providerTransferStatus: string | null; netCents: number; pixKey: string | null; pixKeyMasked: string; pixKeyType: string | null; grossCents: number; administrativeFeeCents: number; transactionFeeCents: number } | null;
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(cents / 100);
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
}).format(new Date(value));

export function AdminPrizePayout() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [references, setReferences] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [copiedPixKey, setCopiedPixKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/prizes/pending", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os ganhadores.");
      setWinners(body.winners as Winner[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar os ganhadores.");
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
    try { await navigator.clipboard.writeText(key); setCopiedPixKey(winner.id); setNotice("Chave Pix do prêmio de " + winner.playerName + " copiada."); }
    catch { setError("Não foi possível copiar a chave Pix. Copie manualmente o texto exibido."); }
  }

  async function confirmPaid(winner: Winner) {
    if (!winner.paymentRequest || !window.confirm(
      "Confirma que o Pix de " + money(winner.paymentRequest.netCents) +
      " já foi realizado para " + winner.playerName + " e que o comprovante foi conferido?"
    )) return;
    setBusy(winner.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/prizes/" + encodeURIComponent(winner.id) + "/payout", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference: references[winner.id]?.trim() || undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível registrar o pagamento.");
      setNotice("Pagamento confirmado. Pedido removido da fila.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao confirmar o pagamento.");
    } finally { setBusy(""); }
  }

  async function releaseFailed(winner: Winner) {
    if (!winner.paymentRequest || !window.confirm(
      "Liberar a solicitação deste recibo para que o ganhador possa enviar uma nova solicitação? Isso não confirma pagamento."
    )) return;
    setBusy(winner.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/prize-payment-requests/" + encodeURIComponent(winner.paymentRequest.id) + "/release", {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível liberar a solicitação.");
      setNotice("Solicitação liberada. O ganhador poderá pedir o pagamento novamente.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao liberar a solicitação.");
    } finally { setBusy(""); }
  }

  const pending = winners.filter((winner) => !winner.paid && winner.physicalReceiptEligible && winner.paymentRequest !== null);


  return <section className="feature-card admin-prize-payout" aria-labelledby="admin-prize-payout-heading">
    <span className="feature-label">PRÊMIOS</span>
    <h2 id="admin-prize-payout-heading">Pedidos de prêmio ({pending.length})</h2>
    {error && <p role="alert" className="note-inline">{error}</p>}
    {notice && <p role="status" className="note-inline">{notice}</p>}
    {loading ? <p>Carregando…</p> : pending.length === 0
      ? <p>Nenhum pedido de prêmio pendente.</p>
      : <div className="admin-round-list">
        {pending.map((winner) => <article className="round-option admin-prize-card" key={winner.id}>
          <strong>{winner.playerName}</strong>
          <p><strong>{money(winner.paymentRequest!.netCents)}</strong> · Prêmio: {money(winner.prizeCents)} · {winner.prizeCategoryLabel ?? "Prêmio"}</p>
          <p>Recibo: {winner.receiptCode ?? "—"} · Rodada: {winner.roundCode}</p>
          <p>Pix: <strong>{winner.paymentRequest!.pixKey ?? winner.paymentRequest!.pixKeyMasked}</strong>{winner.paymentRequest!.pixKeyType ? " · " + winner.paymentRequest!.pixKeyType : ""}</p>
          <div className="round-options">
            <button type="button" className="secondary-button" disabled={!winner.paymentRequest!.pixKey} onClick={() => void copyPixKey(winner)}>{copiedPixKey === winner.id ? "Chave copiada" : "Copiar chave Pix"}</button>
            <button type="button" disabled={Boolean(busy) || !winner.calculationConsistent || !["PENDING", "PROCESSING"].includes(winner.paymentRequest!.status)} onClick={() => void confirmPaid(winner)}>
              {busy === winner.id ? "Registrando…" : "Confirmar pagamento"}
            </button>
          </div>
          {["FAILED", "CANCELLED", "REJECTED"].includes(winner.paymentRequest!.status) && <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => void releaseFailed(winner)}>Liberar nova solicitação</button>}
          {!winner.calculationConsistent && <p role="alert">Conferência necessária. Pagamento bloqueado até corrigir a divergência.</p>}
          <label>Referência Pix (opcional)
            <input value={references[winner.id] ?? ""} maxLength={300} onChange={(event) => setReferences((current) => ({ ...current, [winner.id]: event.target.value }))} placeholder="ID da transação" />
          </label>
        </article>)}
      </div>}
    <button type="button" className="secondary-button" disabled={loading} onClick={() => { setLoading(true); setError(""); void load(); }}>Atualizar pedidos</button>
  </section>;
}
