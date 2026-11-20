"use client";

import { useCallback, useEffect, useState } from "react";

type Withdrawal = {
  id: string; amountCents: number; status: "PENDING" | "APPROVED" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED";
  providerRef: string | null; createdAt: string; updatedAt: string;
  statusHistory: Array<{ toStatus: string; note: string | null; createdAt: string }>;
};
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo", hourCycle: "h23" }).format(new Date(value));
const labels: Record<Withdrawal["status"], string> = {
  PENDING: "Solicitação em análise",
  APPROVED: "Solicitação em análise",
  PROCESSING: "Solicitação em análise",
  PAID: "Pagamento concluído com sucesso",
  REJECTED: "Saque recusado — saldo devolvido à carteira",
  FAILED: "Pagamento pendente de revisão administrativa",
};

export function PlayerWalletWithdrawals() {
  const [availableCents, setAvailableCents] = useState(0);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [pixKey, setPixKey] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pixKeyType, setPixKeyType] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/player/withdrawals", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível consultar a carteira.");
      setAvailableCents(body.availableCents);
      window.dispatchEvent(new CustomEvent("superquina:player-wallet-updated", { detail: { availableCents: body.availableCents } }));
      setWithdrawals(body.withdrawals);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao consultar a carteira."); }
    finally { setLoading(false); }
  }, []);

  const hasProcessingWithdrawal = withdrawals.some((item) => item.status === "PENDING" || item.status === "PROCESSING" || item.status === "APPROVED");

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const interval = hasProcessingWithdrawal ? window.setInterval(() => { void load(); }, 15_000) : null;
    return () => {
      window.clearTimeout(initial);
      if (interval !== null) window.clearInterval(interval);
    };
  }, [load, hasProcessingWithdrawal]);

  function reviewWithdrawal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (availableCents <= 0) { setError("Não há saldo disponível para sacar."); return; }
    if (!pixKeyType) { setError("Informe o tipo de chave Pix."); return; }
    if (!pixKey.trim()) { setError("Informe a chave Pix."); return; }
    setReviewOpen(true);
  }

  async function confirmWithdrawal() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/player/withdrawals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pixKey: pixKey.trim(), pixKeyType }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível solicitar o saque.");
      setReviewOpen(false); setPixKey(""); await load();
    } catch (reason) { setReviewOpen(false); setError(reason instanceof Error ? reason.message : "Falha ao solicitar o saque."); }
    finally { setBusy(false); }
  }

  return <section className="player-wallet-withdrawals-content">
    <p className="wallet-balance">{loading ? "Consultando saldo…" : money(availableCents)} <small>disponível</small></p>
    <form className="admin-round-create" onSubmit={reviewWithdrawal}>
      <label className="wallet-pix-type-field">Tipo da chave Pix<select className="wallet-pix-type-select" required value={pixKeyType} onChange={(event) => setPixKeyType(event.target.value)}><option value="" disabled>Informe o tipo de chave Pix</option><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option><option value="EMAIL">E-mail</option><option value="PHONE">Telefone</option><option value="EVP">Chave aleatória</option></select></label>
      <label>Chave Pix<input value={pixKey} onChange={(event) => setPixKey(event.target.value)} maxLength={200} autoComplete="off" required /></label>
      <p><small>O pagamento do saque é realizado pela administração via Pix. O status será atualizado assim que a transferência for confirmada.</small></p>
      <button type="submit" disabled={loading || busy || availableCents <= 0 || !pixKeyType}>{busy ? "Solicitando…" : "Solicitar saque"}</button>
    </form>
    {reviewOpen && <div role="presentation" className="wallet-withdrawal-confirm-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="withdrawal-confirm-title" className="wallet-withdrawal-confirm-dialog">
        <h3 id="withdrawal-confirm-title">Confirme os dados do Pix</h3>
        <p>Confira com atenção se a chave e o tipo estão corretos antes de solicitar o saque.</p>
        <dl>
          <dt>Tipo da chave</dt><dd>{pixKeyType === "EMAIL" ? "E-mail" : pixKeyType === "PHONE" ? "Telefone" : pixKeyType === "EVP" ? "Chave aleatória" : pixKeyType}</dd>
          <dt>Chave Pix</dt><dd className="wallet-withdrawal-confirm-key">{pixKey.trim()}</dd>
        </dl>
        <div className="wallet-withdrawal-confirm-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={() => setReviewOpen(false)}>Voltar e corrigir</button>
          <button type="button" disabled={busy} onClick={() => void confirmWithdrawal()}>{busy ? "Confirmando…" : "Confirmar e solicitar saque"}</button>
        </div>
      </section>
    </div>}
    {error && <p role="alert" className="note-inline">{error}</p>}
    <h3>Histórico de saques</h3>
    {loading ? <p>Carregando histórico…</p> : withdrawals.length === 0 ? <p>Nenhum saque solicitado ainda.</p> : <div className="admin-round-list">
      {withdrawals.map((item) => <article className="round-option" key={item.id}>
        <div><strong>{money(item.amountCents)}</strong> · {labels[item.status]}</div>
        <p>Solicitado em {dateTime(item.createdAt)}</p>
        {item.status === "PAID" && <p>Pagamento confirmado em {dateTime(item.updatedAt)}</p>}
        {item.status === "REJECTED" && <p>O valor foi devolvido ao saldo disponível da carteira.</p>}
      </article>)}
    </div>}
    <button type="button" className="secondary-button" disabled={loading || busy} onClick={() => void load()}>Atualizar carteira</button>
  </section>;
}
