"use client";

import { useCallback, useEffect, useState } from "react";

type Account = {
  id: string;
  username: string;
  fullName: string | null;
  whatsapp: string | null;
  role: "PLAYER" | "CASHIER";
  status: "ACTIVE" | "BLOCKED" | "PENDING";
  createdAt: string;
};

export function AdminUserDataErasure() {
  const [users, setUsers] = useState<Account[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users?q=" + encodeURIComponent(query.trim()), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar as contas.");
      setUsers(body.users as Account[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar contas.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function erase(account: Account) {
    const label = account.fullName || account.username;
    if (!window.confirm("Excluir permanentemente os dados pessoais da conta " + label + " (" + account.username + ")? A conta perderá o acesso imediatamente.")) return;
    const confirmationUsername = window.prompt("Para confirmar, digite exatamente o usuário: " + account.username);
    if (confirmationUsername !== account.username) {
      setError("Confirmação cancelada: o nome de usuário não confere.");
      return;
    }
    const reason = window.prompt("Informe o motivo da exclusão (mínimo de 8 caracteres):");
    if (!reason || reason.trim().length < 8) {
      setError("Exclusão cancelada. Informe um motivo válido.");
      return;
    }
    setBusy(account.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users/" + encodeURIComponent(account.id), {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmationUsername, reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível excluir os dados pessoais.");
      setUsers(current => current.filter(user => user.id !== account.id));
      setNotice("Dados pessoais de " + account.username + " removidos. Registros financeiros e de auditoria necessários foram preservados.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao excluir os dados pessoais.");
    } finally {
      setBusy(null);
    }
  }

  return <section className="feature-card" aria-labelledby="admin-user-erasure-heading">
    <span className="feature-label">Privacidade e contas</span>
    <h2 id="admin-user-erasure-heading">Exclusão de usuários</h2>
    <p>Localize jogadores ou cambistas e remova permanentemente seus dados pessoais e o acesso à plataforma. Registros financeiros e de auditoria sujeitos à retenção são preservados, sem dados pessoais desnecessários.</p>
    <label htmlFor="admin-user-erasure-search">Pesquisar por nome, usuário ou WhatsApp</label>
    <input id="admin-user-erasure-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Digite para pesquisar" />
    {error && <p role="alert" className="note-inline">{error}</p>}
    {notice && <p role="status" className="note-inline">{notice}</p>}
    {loading ? <p>Carregando contas…</p> : users.length === 0 ? <p>Nenhuma conta encontrada.</p> : <div className="admin-round-list">
      {users.map(account => <article className="round-option" key={account.id}>
        <div>
          <strong>{account.fullName || account.username}</strong>
          <p>{account.role === "PLAYER" ? "Jogador" : "Cambista"} · Usuário: {account.username}</p>
          <p>WhatsApp: {account.whatsapp || "Não informado"} · Status: {account.status === "ACTIVE" ? "Ativo" : account.status === "BLOCKED" ? "Bloqueado" : "Pendente"}</p>
          <p>Cadastro: {new Date(account.createdAt).toLocaleDateString("pt-BR")}</p>
        </div>
        <button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void erase(account)}>
          {busy === account.id ? "Excluindo…" : "Excluir dados da conta"}
        </button>
      </article>)}
    </div>}
    <button type="button" className="secondary-button admin-payment-refresh" disabled={loading || busy !== null} onClick={() => void load()}>Atualizar lista</button>
  </section>;
}
