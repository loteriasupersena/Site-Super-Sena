"use client";

const prizes = [
  { label: "Unidade", amountCents: 600 },
  { label: "Dezena", amountCents: 2_000 },
  { label: "Centena", amountCents: 20_000 },
  { label: "Milhar", amountCents: 200_000 },
  { label: "Quina", amountCents: 2_000_000 },
  { label: "Sena", amountCents: 20_000_000 },
];

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function AdminPrizeRules() {
  return (
    <section className="feature-card" aria-labelledby="admin-prize-rules-heading">
      <span className="feature-label">Regras do jogo</span>
      <h2 id="admin-prize-rules-heading">Valores fixos dos prêmios</h2>
      <p>Todo jogo de seis dígitos custa R$ 6,00. O valor é fixo para jogadores e cambistas. Cada jogo reserva R$ 1,00 para cada uma das seis categorias.</p>
      <div className="admin-prize-fixed-grid">
        {prizes.map((prize) => (
          <article className="admin-prize-fixed-card" key={prize.label}>
            <strong>{prize.label}</strong>
            <span>{money(prize.amountCents)}</span>
          </article>
        ))}
      </div>
      <p className="note-inline">Cada aposta paga somente a maior faixa acertada. A regra nova vale para novas apostas; apostas e prêmios já registrados preservam os valores gravados na época.</p>
    </section>
  );
}
