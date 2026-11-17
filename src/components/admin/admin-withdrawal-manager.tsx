"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Item = {
  id: string; username: string; amountCents: number;
  status: "PENDING" | "APPROVED" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED";
  pixKey: string | null; pixKeyMasked: string; holderName?: string | null; providerRef: string | null; asaasTransferId?: string | null; asaasTransferStatus?: string | null; asaasTransferFailureReason?: string | null; holderCpfMasked?: string | null;
  createdAt: string; updatedAt: string; reviewedBy: string | null;
  statusHistory: Array<{ fromStatus: string | null; toStatus: string; note: string | null; createdAt: string; actor: string }>;
};
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo", hourCycle: "h23" }).format(new Date(value));
const labels: Record<Item["status"], string> = { PENDING: "Aguardando aprovação", APPROVED: "Em análise", PROCESSING: "Pix em processamento", PAID: "Pago", REJECTED: "Valor devolvido", FAILED: "Transferência recusada — pode ser reavaliada" };

export function AdminWithdrawalManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadController = useRef<AbortController | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setError("");
    try {
      const response = await fetch("/api/admin/withdrawals", { cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível consultar os saques.");
      if (!controller.signal.aborted) setItems(body.items);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Falha ao consultar os saques.");
    } finally {
      if (loadController.current === controller) { loadController.current = null; setLoading(false); }
    }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => { window.clearTimeout(timer); loadController.current?.abort(); }; }, [load]);

  async function act(item: Item, action: "send-asaas" | "reject") {
    const note = action === "send-asaas"
      ? "Administrador autorizou o envio Pix pela Asaas."
      : rejectionReasons[item.id]?.trim() ?? "";
    if (action === "reject" && note.length < 4) {
      setError("Informe o motivo da liberação para registrar na auditoria e mostrar ao jogador.");
      return;
    }
    setBusy(item.id); setError(""); setNotice("");
    try {
      const response = action === "send-asaas"
        ? await fetch(`/api/admin/withdrawals/${encodeURIComponent(item.id)}/transfer`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
        : await fetch("/api/admin/withdrawals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ withdrawalId: item.id, action, note }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível atualizar o saque.");
      setRejectionReasons((current) => { const next = { ...current }; delete next[item.id]; return next; });
      setNotice(action === "send-asaas"
        ? `Transferência de ${money(item.amountCents)} enviada à Asaas. O saque aguarda confirmação bancária.`
        : `Valor liberado. A reserva de ${money(body.withdrawal.amountCents)} foi liberada na carteira do jogador.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao atualizar o saque."); }
    finally { setBusy(null); }
  }

  const pending = items.filter((item) => item.status === "PENDING" || item.status === "FAILED");
  const history = items.filter((item) => item.status !== "PENDING" && item.status !== "FAILED");

  return <section className="feature-card" aria-labelledby="admin-withdrawals-heading">
    <span className="feature-label">Financeiro</span>
    <h2 id="admin-withdrawals-heading">Saques das carteiras digitais</h2>
    <p>Confira os dados do titular. Saques de R$ 1.000,00 ou mais aguardam sua autorização; ao autorizar, a Asaas envia o Pix. O saque só é concluído após a confirmação bancária.</p>
    {error && <p role="alert" className="note-inline">{error}</p>}
    {notice && <p role="status" className="note-inline">{notice}</p>}
    {loading ? <p>Carregando solicitações…</p> : pending.length === 0 ? <p>Não há saques pendentes.</p> : <div className="admin-round-list">
      {pending.map((item) => <article className="round-option" key={item.id}>
        <div><strong>{item.username}</strong> · {money(item.amountCents)} · {labels[item.status]}</div>
        <p>Solicitado em {dateTime(item.createdAt)}</p>
        <p>Titular: <strong>{item.holderName ?? "Nome não disponível"}</strong></p>
        <p>Chave Pix: <strong>{item.pixKey ?? item.pixKeyMasked}</strong></p>
        {item.holderCpfMasked && <p>CPF do titular: {item.holderCpfMasked}</p>}
        {item.asaasTransferFailureReason && <p role="alert">{item.asaasTransferFailureReason}</p>}
        <label>Motivo da liberação (obrigatório)<textarea value={rejectionReasons[item.id] ?? ""} onChange={(event) => setRejectionReasons((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={500} rows={2} placeholder="Ex.: chave Pix inválida ou não localizada." /></label>
        <div className="round-options">
          <button type="button" disabled={busy !== null || item.amountCents < 100000 || Boolean(item.asaasTransferId)} onClick={() => void act(item, "send-asaas")}>{busy === item.id ? "Enviando…" : "Autorizar Pix pela Asaas"}</button>
          <button type="button" className="secondary-button" disabled={busy !== null || (rejectionReasons[item.id]?.trim().length ?? 0) < 4} onClick={() => void act(item, "reject")}>Liberar valor e devolver saldo</button>
        </div>
      </article>)}
    </div>}
    <h3>Histórico de saques</h3>
    {loading ? <p>Carregando histórico…</p> : history.length === 0 ? <p>Nenhum saque encerrado.</p> : <div className="admin-round-list">
      {history.map((item) => <article className="round-option" key={item.id}>
        <div><strong>{item.username}</strong> · {money(item.amountCents)} · {labels[item.status]}</div>
        <p>Solicitado em {dateTime(item.createdAt)}{item.providerRef ? " · Referência: " + item.providerRef : ""}</p>
        <p>Revisado por: {item.reviewedBy ?? "—"}</p>
        {item.statusHistory.map((event, index) => <p key={item.id + event.createdAt + index}><small>{dateTime(event.createdAt)} · {event.actor} · {event.note ?? labels[event.toStatus as Item["status"]]}</small></p>)}
      </article>)}
    </div>}
    <button type="button" className="secondary-button" disabled={loading || busy !== null} onClick={() => void load()}>Atualizar saques</button>
  </section>;
}
