"use client";

import { useEffect, useMemo, useState } from "react";

type Player = { id: string; username: string; fullName: string | null; status: "ACTIVE" | "BLOCKED" | "PENDING" };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function AdminTestWalletCredit() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [userId, setUserId] = useState("");
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/test-wallet-credit", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os jogadores.");
        if (active) setPlayers(body.items as Player[]);
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Falha ao carregar jogadores."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visiblePlayers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return players.filter((player) => !term || player.username.toLocaleLowerCase("pt-BR").includes(term) || (player.fullName ?? "").toLocaleLowerCase("pt-BR").includes(term));
  }, [players, query]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice("");
    const normalized = amount.trim().replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    if (!userId) { setError("Selecione um jogador."); return; }
    if (!Number.isFinite(value) || value <= 0 || Math.round(value * 100) !== value * 100 || value > 1_000_000) {
      setError("Informe um valor válido, com até duas casas decimais e máximo de R$ 1.000.000,00."); return;
    }
    if (reason.trim().length < 8) { setError("Informe o motivo do crédito com pelo menos 8 caracteres."); return; }
    if (!window.confirm(`Confirma adicionar ${money(Math.round(value * 100))} à carteira do jogador selecionado como crédito de teste?`)) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/test-wallet-credit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, amountCents: Math.round(value * 100), reason: reason.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível registrar o crédito.");
      setNotice(`Crédito de ${money(body.credit.amountCents)} registrado para ${body.credit.player}. O lançamento foi identificado no extrato como ajuste administrativo de teste.`);
      setAmount(""); setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao registrar o crédito.");
    } finally { setSaving(false); }
  }

  return <section className="feature-card" aria-labelledby="admin-test-wallet-credit-heading">
    <span className="feature-label">Ferramenta administrativa</span>
    <h2 id="admin-test-wallet-credit-heading">Adicionar crédito para jogador de teste</h2>
    <p>Adiciona saldo sacável à carteira de um jogador já cadastrado, sem gerar cobrança Pix ou acionar o Asaas. Use somente valores que já estejam disponíveis na conta Asaas da operação; o crédito registra esse lastro no livro-razão para permitir testar compras, prêmios e saques Pix reais. A operação fica registrada na auditoria administrativa.</p>
    {loading ? <p>Carregando jogadores…</p> : <form className="admin-round-create" onSubmit={submit}>
      <label>Buscar jogador
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome ou usuário" disabled={saving} />
      </label>
      <label>Jogador cadastrado
        <select required value={userId} onChange={(event) => setUserId(event.target.value)} disabled={saving}>
          <option value="">Selecione um jogador</option>
          {visiblePlayers.map((player) => <option key={player.id} value={player.id} disabled={player.status !== "ACTIVE"}>
            {player.fullName ? player.fullName + " · " : ""}{player.username}{player.status !== "ACTIVE" ? " · conta inativa" : ""}
          </option>)}
        </select>
      </label>
      <label>Valor do crédito (R$)
        <input type="text" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ex.: 50,00" maxLength={15} required disabled={saving} />
      </label>
      <label>Motivo do crédito
        <textarea rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: saldo para testar compra e carteira digital" required disabled={saving} />
      </label>
      <div className="round-actions"><button type="submit" disabled={saving || loading || players.length === 0}>{saving ? "Registrando crédito…" : "Adicionar crédito de teste"}</button></div>
    </form>}
    {!loading && players.length === 0 && <p>Não há jogadores cadastrados disponíveis.</p>}
    {!loading && players.length > 0 && visiblePlayers.length === 0 && <p>Nenhum jogador corresponde à busca.</p>}
    <div className="form-feedback-slot" aria-live="polite">
      {error && <p role="alert" className="note-inline form-feedback-error">{error}</p>}
      {notice && <p role="status" className="note-inline form-feedback-success">{notice}</p>}
    </div>
    <p className="note-inline">Este lançamento não movimenta dinheiro no Asaas: ele registra na carteira um valor que já deve estar disponível no saldo Asaas para cobrir eventual saque. Confirme o lastro antes de conceder. A concessão é permanente no histórico e qualquer reversão deverá ser feita por lançamento compensatório auditado.</p>
  </section>;
}
