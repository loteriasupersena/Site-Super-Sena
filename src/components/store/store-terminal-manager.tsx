"use client";

import { useCallback, useEffect, useState } from "react";

type Terminal = {
  id: string;
  username: string;
  fullName: string | null;
  status: "ACTIVE" | "BLOCKED" | "PENDING";
  createdAt: string;
};

export function StoreTerminalManager() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/store/terminals", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os acessos.");
      setTerminals(body.terminals as Terminal[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao consultar os acessos.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const response = await fetch("/api/store/terminals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName, username, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível criar o acesso.");
      setNotice(body.message ?? "Acesso criado.");
      setFullName("");
      setUsername("");
      setPassword("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao criar o acesso.");
    } finally { setSaving(false); }
  }

  return (
    <section className="feature-card" aria-labelledby="store-terminals-heading">
      <span className="feature-label">Operação da loja</span>
      <h2 id="store-terminals-heading">Maquininhas e acessos</h2>
      <p>Crie um usuário e uma senha exclusivos para cada maquininha. O equipamento pode ser usado em outra loja após sair da sessão e entrar com o acesso daquela loja.</p>
      {loading ? <p>Carregando acessos…</p> : terminals.length ? (
        <div className="admin-list">
          {terminals.map((terminal) => (
            <article className="round-option" key={terminal.id}>
              <strong>{terminal.fullName || terminal.username}</strong>
              <p>Usuário: <strong>{terminal.username}</strong></p>
              <p>Situação: {terminal.status === "ACTIVE" ? "Ativo" : terminal.status === "BLOCKED" ? "Bloqueado" : "Pendente"}</p>
            </article>
          ))}
        </div>
      ) : <p>Nenhuma maquininha cadastrada.</p>}
      <form className="admin-round-create" onSubmit={submit}>
        <h3>Cadastrar maquininha</h3>
        <label>Identificação da maquininha
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={3} maxLength={120} required placeholder="Ex.: Caixa 01" />
        </label>
        <label>Usuário de acesso
          <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={24} autoComplete="off" required placeholder="Ex.: caixa01" />
        </label>
        <label>Senha inicial
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={1024} autoComplete="new-password" required />
        </label>
        <p>A senha é armazenada apenas como hash. O operador deverá alterá-la no primeiro acesso. Não compartilhe a senha por canais inseguros.</p>
        <div className="round-actions">
          <button type="submit" disabled={saving || loading || !fullName.trim() || !username.trim() || password.length < 8}>{saving ? "Criando…" : "Criar acesso"}</button>
          <button type="button" disabled={saving || loading} onClick={() => void load()}>Atualizar lista</button>
        </div>
      </form>
      <div className="form-feedback-slot" aria-live="polite">
        {error && <p role="alert" className="note-inline form-feedback-error">{error}</p>}
        {notice && <p role="status" className="note-inline form-feedback-success">{notice}</p>}
      </div>
    </section>
  );
}
