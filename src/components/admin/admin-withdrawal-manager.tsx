"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Item = {
  id: string; username: string; amountCents: number;
  status: "PENDING" | "APPROVED" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED";
  pixKey: string | null; pixKeyMasked: string; providerRef: string | null;
  createdAt: string; updatedAt: string; reviewedBy: string | null;
  statusHistory: Array<{ fromStatus: string | null; toStatus: string; note: string | null; createdAt: string; actor: string }>;
};
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo", hourCycle: "h23" }).format(new Date(value));
const labels: Record<Item["status"], string> = { PENDING: "Aguardando aprovação", APPROVED: "Em análise", PROCESSING: "Aguardando conferência do pagamento", PAID: "Pago", REJECTED: "Valor devolvido", FAILED: "Pagamento pendente de revisão" };

export function AdminWithdrawalManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadController = useRef<AbortController | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});

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
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); const poll = window.setInterval(() => { void load(); }, 10_000); return () => { window.clearTimeout(timer); window.clearInterval(poll); loadController.current?.abort(); }; }, [load]);

  async function act(item: Item, action: "confirm-paid" | "reject") {
    const note = rejectionReasons[item.id]?.trim() ?? "";
    if (action === "reject" && note.length < 4) {
      setError("Informe o motivo da liberação para registrar na auditoria e mostrar ao jogador.");
      return;
    }
    setBusy(item.id); setError(""); setNotice("");
    try {
      const response = action === "confirm-paid"
        ? await fetch(`/api/admin/withdrawals/${encodeURIComponent(item.id)}/transfer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference: references[item.id]?.trim() || undefined }) })
        : await fetch("/api/admin/withdrawals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ withdrawalId: item.id, action, note }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível atualizar o saque.");
      setRejectionReasons((current) => { const next = { ...current }; delete next[item.id]; return next; });
      setNotice(action === "confirm-paid"
        ? `Pagamento Pix de ${money(item.amountCents)} confirmado e registrado.`
        : `Valor liberado. A reserva de ${money(body.withdrawal.amountCents)} foi liberada na carteira do jogador.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao atualizar o saque."); }
    finally { setBusy(null); }
  }

  const pending = items.filter((item) => item.status === "PENDING" || item.status === "FAILED" || item.status === "PROCESSING");
  const history = items.filter((item) => item.status !== "PENDING" && item.status !== "FAILED");

  return <section className="feature-card" aria-labelledby="admin-withdrawals-heading">
    <span className="feature-label">Financeiro</span>
    <h2 id="admin-withdrawals-heading">Saques das carteiras digitais</h2>
    <p>Confira a chave Pix informada. Realize a transferência fora do sistema e use a confirmação somente depois de verificar que o valor foi efetivamente enviado.</p>
    {error && <p role="alert" className="note-inline">{error}</p>}
    {notice && <p role="status" className="note-inline">{notice}</p>}
    {loading ? <p>Carregando solicitações…</p> : pending.length === 0 ? <p>Não há saques pendentes.</p> : <div className="admin-round-list">
      {pending.map((item) => <article className="round-option" key={item.id}>
        <div><strong>{item.username}</strong> · {money(item.amountCents)} · {labels[item.status]}</div>
        <p>Solicitado em {dateTime(item.createdAt)}</p>
        <p>Chave Pix: <strong>{item.pixKey ?? item.pixKeyMasked}</strong></p>
        <label>Referência do comprovante (opcional)<input value={references[item.id] ?? ""} onChange={(event) => setReferences((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={300} placeholder="Identificador da transação Pix" /></label>
        <label>Motivo da liberação (obrigatório)<textarea value={rejectionReasons[item.id] ?? ""} onChange={(event) => setRejectionReasons((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={500} rows={2} placeholder="Ex.: chave Pix inválida ou não localizada." /></label>
        <div className="round-options">
          <button type="button" disabled={busy !== null} onClick={() => void act(item, "confirm-paid")}>{busy === item.id ? "Registrando…" : "Confirmar Pix pago"}</button>
          <button type="button" className="secondary-button" disabled={busy !== null || item.status === "PROCESSING" || (rejectionReasons[item.id]?.trim().length ?? 0) < 4} onClick={() => void act(item, "reject")}>Liberar valor e devolver saldo</button>
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
