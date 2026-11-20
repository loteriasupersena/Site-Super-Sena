"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Item = {
  id: string; username: string; amountCents: number;
  status: "PENDING" | "APPROVED" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED";
  pixKey: string | null; pixKeyType: string | null; pixKeyMasked: string;
};
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const labels: Record<Item["status"], string> = { PENDING: "Aguardando pagamento", APPROVED: "Aprovado — aguardando pagamento Pix", PROCESSING: "Aguardando conferência do pagamento", PAID: "Pago", REJECTED: "Valor devolvido", FAILED: "Pagamento pendente de revisão" };

export function AdminWithdrawalManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadController = useRef<AbortController | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [copiedPixKey, setCopiedPixKey] = useState<string | null>(null);

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

  async function copyPixKey(item: Item) {
    if (!item.pixKey) return;
    try {
      await navigator.clipboard.writeText(item.pixKey);
      setCopiedPixKey(item.id);
      setNotice("Chave Pix de " + item.username + " copiada.");
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione e copie a chave Pix manualmente.");
    }
  }

  async function act(item: Item, action: "confirm-paid" | "reject") {
    if (action === "confirm-paid" && !window.confirm("Confirma que o Pix de " + money(item.amountCents) + " já foi transferido e conferido no banco?")) return;
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
        ? `Pagamento Pix de ${money(item.amountCents)} confirmado. Pedido removido da fila.`
        : `Valor liberado. A reserva de ${money(body.withdrawal.amountCents)} foi liberada na carteira do jogador.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao atualizar o saque."); }
    finally { setBusy(null); }
  }

  const pending = items.filter((item) => item.status === "PENDING" || item.status === "APPROVED" || item.status === "FAILED" || item.status === "PROCESSING");

  return <section className="feature-card" aria-labelledby="admin-withdrawals-heading">
    <span className="feature-label">CARTEIRA DIGITAL</span>
    <h2 id="admin-withdrawals-heading">Pedidos de saque ({pending.length})</h2>
    {error && <p role="alert" className="note-inline">{error}</p>}
    {notice && <p role="status" className="note-inline">{notice}</p>}
    {loading ? <p>Carregando…</p> : pending.length === 0 ? <p>Nenhum pedido de saque pendente.</p> : <div className="admin-round-list">
      {pending.map((item) => <article className="round-option" key={item.id}>
        <strong>{item.username}</strong>
        <p><strong>{money(item.amountCents)}</strong> · {labels[item.status]}</p>
        <p>Pix: <strong>{item.pixKey ?? item.pixKeyMasked}</strong>{item.pixKeyType ? " · " + item.pixKeyType : ""}</p>
        <div className="round-options">
          <button type="button" className="secondary-button" disabled={!item.pixKey} onClick={() => void copyPixKey(item)}>{copiedPixKey === item.id ? "Chave copiada" : "Copiar chave Pix"}</button>
          <button type="button" disabled={busy !== null} onClick={() => void act(item, "confirm-paid")}>{busy === item.id ? "Registrando…" : "Confirmar pagamento"}</button>
        </div>
        {item.status !== "PROCESSING" && item.status !== "APPROVED" && <details>
          <summary>Devolver saldo</summary>
          <label>Motivo
            <textarea value={rejectionReasons[item.id] ?? ""} onChange={(event) => setRejectionReasons((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={500} rows={2} placeholder="Informe o motivo." />
          </label>
          <button type="button" className="secondary-button" disabled={busy !== null || (rejectionReasons[item.id]?.trim().length ?? 0) < 4} onClick={() => void act(item, "reject")}>Devolver saldo</button>
        </details>}
        <label>Referência Pix (opcional)
          <input value={references[item.id] ?? ""} onChange={(event) => setReferences((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={300} placeholder="ID da transação" />
        </label>
      </article>)}
    </div>}
    <button type="button" className="secondary-button" disabled={loading || busy !== null} onClick={() => void load()}>Atualizar pedidos</button>
  </section>;
}
