"use client";

import { useCallback, useEffect, useState } from "react";

type Withdrawal = {
  id: string; amountCents: number; status: "PENDING" | "APPROVED" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED";
  providerRef: string | null; createdAt: string; updatedAt: string;
  statusHistory: Array<{ toStatus: string; note: string | null; createdAt: string }>;
};
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo", hourCycle: "h23" }).format(new Date(value));
const labels: Record<Withdrawal["status"], string> = { PENDING: "Solicitação recebida — em análise", APPROVED: "Solicitação em análise", PROCESSING: "Transferência em análise", PAID: "Pagamento confirmado", REJECTED: "Valor devolvido à carteira", FAILED: "Solicitação precisa de nova análise" };

export function PlayerWalletWithdrawals() {
  const [availableCents, setAvailableCents] = useState(0);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyConfirmation, setPixKeyConfirmation] = useState("");
  const [pixKeyType, setPixKeyType] = useState("CPF");
  const [holderName, setHolderName] = useState("");
  const [holderCpf, setHolderCpf] = useState("");
  const [pixKeyConfirmed, setPixKeyConfirmed] = useState(false);
  const [holderConfirmed, setHolderConfirmed] = useState(false);
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

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function requestWithdrawal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (availableCents <= 0) { setError("Não há saldo disponível para sacar."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/player/withdrawals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pixKey: pixKey.trim(), pixKeyConfirmation: pixKeyConfirmation.trim(), pixKeyType, holderName, holderCpf, pixKeyConfirmed, holderConfirmed }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível solicitar o saque.");
      setPixKey(""); setPixKeyConfirmation(""); setHolderName(""); setHolderCpf(""); setPixKeyConfirmed(false); setHolderConfirmed(false); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao solicitar o saque."); }
    finally { setBusy(false); }
  }

  return <section className="player-wallet-withdrawals-content">
    <p className="wallet-balance">{loading ? "Consultando saldo…" : money(availableCents)} <small>disponível</small></p>
    <form className="admin-round-create" onSubmit={requestWithdrawal}>
      <label>Nome completo do titular<input value={holderName} onChange={(event) => setHolderName(event.target.value)} maxLength={160} autoComplete="name" required /></label>
      <label>CPF do titular<input value={holderCpf} onChange={(event) => setHolderCpf(event.target.value)} maxLength={14} inputMode="numeric" placeholder="000.000.000-00" required /></label>
      <label>Tipo da chave Pix<select value={pixKeyType} onChange={(event) => setPixKeyType(event.target.value)}><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option><option value="EMAIL">E-mail</option><option value="PHONE">Telefone</option><option value="EVP">Chave aleatória</option></select></label>
      <label>Chave Pix<input value={pixKey} onChange={(event) => setPixKey(event.target.value)} maxLength={200} autoComplete="off" required /></label>
      <label>Confirme a chave Pix<input value={pixKeyConfirmation} onChange={(event) => setPixKeyConfirmation(event.target.value)} maxLength={200} autoComplete="off" required /></label>
      <label><input type="checkbox" checked={pixKeyConfirmed} onChange={(event) => setPixKeyConfirmed(event.target.checked)} required /> Confirmo que a chave Pix pertence ao titular informado.</label>
      <label><input type="checkbox" checked={holderConfirmed} onChange={(event) => setHolderConfirmed(event.target.checked)} required /> Confirmo que os dados do titular são verdadeiros.</label>
      <p><small>Saques abaixo de R$ 1.000,00 são enviados automaticamente à Asaas. A partir de R$ 1.000,00, dependem de aprovação administrativa. O pagamento só é confirmado após o retorno bancário.</small></p>
      <button type="submit" disabled={loading || busy || availableCents <= 0 || !pixKeyConfirmed || !holderConfirmed}>{busy ? "Solicitando…" : "Solicitar saque"}</button>
    </form>
    {error && <p role="alert" className="note-inline">{error}</p>}
    <h3>Histórico de saques</h3>
    {loading ? <p>Carregando histórico…</p> : withdrawals.length === 0 ? <p>Nenhum saque solicitado ainda.</p> : <div className="admin-round-list">
      {withdrawals.map((item) => <article className="round-option" key={item.id}>
        <div><strong>{money(item.amountCents)}</strong> · {labels[item.status]}</div>
        <p>Solicitado em {dateTime(item.createdAt)}</p>
        {item.status === "PAID" && <p>Pagamento confirmado em {dateTime(item.updatedAt)}</p>}

      </article>)}
    </div>}
    <button type="button" className="secondary-button" disabled={loading || busy} onClick={() => void load()}>Atualizar carteira</button>
  </section>;
}
