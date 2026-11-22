"use client";

import { useCallback, useEffect, useState } from "react";

type Item = {
  id: string;
  source: "RECIBO" | "CARTEIRA";
  sourceLabel: string;
  recipient: string;
  amountCents: number;
  grossCents: number;
  status: string;
  pixKey: string | null;
  pixKeyMasked: string;
  pixKeyType: string | null;
  holderName: string | null;
  holderCpfMasked: string | null;
  reference: string | null;
  detail: string;
  calculationConsistent: boolean;
  createdAt: string;
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const statusLabel: Record<string, string> = {
  PENDING: "AGUARDANDO", APPROVED: "APROVADO", PROCESSING: "EM PROCESSAMENTO",
  FAILED: "FALHA NA TRANSFERÊNCIA",
};

export function AdminPaymentRequests() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/payment-requests", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Falha ao carregar solicitações.");
      setItems(body.items as Item[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar solicitações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, 10_000);
    return () => { window.clearTimeout(initial); window.clearInterval(poll); };
  }, [load]);

  async function copyPix(item: Item) {
    if (!item.pixKey) return;
    try {
      await navigator.clipboard.writeText(item.pixKey);
      setCopied(item.id);
      window.setTimeout(() => setCopied(current => current === item.id ? null : current), 1800);
    } catch { setError("Não foi possível copiar a chave Pix."); }
  }

  async function confirmPayment(item: Item) {
    if (!window.confirm("Confirma que o Pix de " + money(item.amountCents) + " foi transferido e conferido no banco?")) return;
    setBusy(item.id); setError(""); setNotice("");
    try {
      const url = item.source === "RECIBO"
        ? "/api/admin/prizes/" + encodeURIComponent(item.id) + "/payout"
        : "/api/admin/withdrawals/" + encodeURIComponent(item.id) + "/transfer";
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível confirmar o pagamento.");
      setNotice("Pagamento confirmado e registrado no histórico.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao confirmar pagamento.");
    } finally { setBusy(null); }
  }

  async function rejectWithdrawal(item: Item) {
    const note = window.prompt("Informe o motivo da rejeição e da liberação do saldo (mínimo 4 caracteres):");
    if (!note || note.trim().length < 4) return;
    if (!window.confirm("Confirma rejeitar esta solicitação e liberar o valor reservado na carteira?")) return;
    setBusy(item.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/withdrawals", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ withdrawalId: item.id, action: "reject", note: note.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível rejeitar o saque.");
      setNotice("Solicitação rejeitada e saldo liberado na carteira.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao rejeitar solicitação.");
    } finally { setBusy(null); }
  }

  return <section className="feature-card admin-payment-requests" aria-labelledby="admin-payment-requests-heading">
    <div className="admin-payment-card-heading">
      <h2 id="admin-payment-requests-heading" className="sr-only">Solicitações de pagamento</h2>
    </div>
    {error && <p role="alert" className="note-inline">{error}</p>}
    {notice && <p role="status" className="note-inline">{notice}</p>}
    {loading ? <p>Carregando solicitações…</p> : items.length === 0
      ? <p>Nenhuma solicitação de pagamento pendente.</p>
      : <div className="admin-payment-list">
        {items.map(item => <article className="admin-payment-item" key={item.source + ":" + item.id}>
          <div className="admin-payment-item-top">
            <div><span className="admin-payment-source">{item.sourceLabel}</span><strong>{item.recipient}</strong></div>
            <strong className="admin-payment-amount">{money(item.amountCents)}</strong>
          </div>
          <p className="admin-payment-status">{statusLabel[item.status] ?? item.status}</p>
          <p className="admin-payment-detail">{item.detail}{item.reference ? " · Recibo: " + item.reference : ""}</p>
          <div className="admin-payment-pix-details">
            <span>Chave Pix ({item.pixKeyType ?? "tipo não informado"})</span>
            <strong>{item.pixKey ?? item.pixKeyMasked}</strong>
            {item.holderName && <span>Titular: {item.holderName}</span>}
            {item.holderCpfMasked && <span>CPF: {item.holderCpfMasked}</span>}
          </div>
          <div className="admin-payment-actions">
            <button type="button" className="secondary-button" disabled={!item.pixKey} onClick={() => void copyPix(item)}>
              {copied === item.id ? "Copiado" : "Copiar chave Pix"}
            </button>
            <button type="button" disabled={busy !== null || (item.source === "RECIBO" && !item.calculationConsistent)} onClick={() => void confirmPayment(item)}>
              {busy === item.id ? "Salvando…" : "Confirmar pagamento"}
            </button>
            {item.source === "CARTEIRA" && ["PENDING", "FAILED"].includes(item.status) && (
              <button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void rejectWithdrawal(item)}>
                Rejeitar e liberar saldo
              </button>
            )}
          </div>
          {item.source === "RECIBO" && !item.calculationConsistent && <p role="alert">Conferência do cálculo necessária. Pagamento bloqueado.</p>}
          <small>Solicitado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.createdAt))}</small>
        </article>)}
      </div>}
    <button type="button" className="secondary-button admin-payment-refresh" disabled={loading || busy !== null} onClick={() => { setLoading(true); void load(); }}>Atualizar agora</button>
    <style jsx>{`
      .admin-payment-list { display: grid; gap: 12px; }
      .admin-payment-item { border: 1px solid #40516a; border-radius: 12px; padding: 14px; background: #203247; color: #f4f6fb; }
      .admin-payment-item-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
      .admin-payment-item-top > div { display: grid; gap: 5px; }
      .admin-payment-source { color: #55d5f0; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
      .admin-payment-amount { font-size: 22px; white-space: nowrap; }
      .admin-payment-detail { color: #cbd5e1; margin: 6px 0 12px; overflow-wrap: anywhere; }
      .admin-payment-pix-details { display: grid; gap: 4px; padding: 12px; border-radius: 8px; background: #172638; overflow-wrap: anywhere; }
      .admin-payment-pix-details span { color: #cbd5e1; font-size: 12px; }
      .admin-payment-pix-details strong { font-size: 15px; }
      .admin-payment-item small { display: block; color: #cbd5e1; margin-top: 10px; }
      @media (max-width: 480px) { .admin-payment-item-top { flex-direction: column; } }
    `}</style>
  </section>;
}
