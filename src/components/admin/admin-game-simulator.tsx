"use client";

import { useState } from "react";

type Totals = { revenue: number; prizes: number; byCategory: Record<string, number>; winners: number };
type Simulation = { rounds: number; betsPerRound: number; stakeCents: number; three: Totals; six: Totals };

const categories = [
  { key: "unit", label: "Unidade", multiplier: 3, digits: 1 },
  { key: "tens", label: "Dezena", multiplier: 30, digits: 2 },
  { key: "hundreds", label: "Centena", multiplier: 300, digits: 3 },
  { key: "quadra", label: "Quadra", multiplier: 3000, digits: 4 },
  { key: "quina", label: "Quina", multiplier: 30000, digits: 5 },
  { key: "sena", label: "Sena", multiplier: 300000, digits: 6 },
] as const;

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const percent = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

function emptyTotals(): Totals {
  return { revenue: 0, prizes: 0, byCategory: { unit: 0, tens: 0, hundreds: 0, quadra: 0, quina: 0, sena: 0 }, winners: 0 };
}

function simulate(rounds: number, betsPerRound: number, stakeCents: number, onProgress: (value: number) => void): Promise<Simulation> {
  return new Promise((resolve) => {
    const three = emptyTotals();
    const six = emptyTotals();
    const base = Math.floor(stakeCents / 6);
    const allocation = { unit: base + stakeCents % 6, tens: base, hundreds: base, quadra: base, quina: base, sena: base };
    let round = 0;

    const batch = () => {
      const stop = Math.min(round + 100, rounds);
      for (; round < stop; round++) {
        const drawn = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
        for (let i = 0; i < betsPerRound; i++) {
          const bet = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
          const match = [...categories].reverse().find((category) => bet.slice(-category.digits) === drawn.slice(-category.digits));
          three.revenue += stakeCents;
          six.revenue += stakeCents;
          if (match) {
            const stake = allocation[match.key];
            const prize3 = stake * match.multiplier;
            const prize6 = match.key === "unit" ? stake * 6 : prize3;
            three.prizes += prize3;
            six.prizes += prize6;
            three.byCategory[match.key] += prize3;
            six.byCategory[match.key] += prize6;
            three.winners++;
            six.winners++;
          }
        }
      }
      onProgress(round / rounds * 100);
      if (round < rounds) setTimeout(batch, 0);
      else resolve({ rounds, betsPerRound, stakeCents, three, six });
    };
    batch();
  });
}

export function AdminGameSimulator() {
  const [rounds, setRounds] = useState("1000");
  const [bets, setBets] = useState("100");
  const [stake, setStake] = useState("1.00");
  const [commission, setCommission] = useState("0");
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Simulation | null>(null);
  const [error, setError] = useState("");

  async function run() {
    const roundCount = Number(rounds);
    const betCount = Number(bets);
    const stakeCents = Math.round(Number(stake.replace(",", ".")) * 100);
    const fee = Number(commission.replace(",", "."));
    if (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > 10000) return setError("Informe de 1 a 10.000 rodadas.");
    if (!Number.isInteger(betCount) || betCount < 1 || betCount > 1000) return setError("Informe de 1 a 1.000 números por rodada.");
    if (!Number.isSafeInteger(stakeCents) || stakeCents < 100) return setError("O valor por número deve ser de pelo menos R$ 1,00.");
    if (!Number.isFinite(fee) || fee < 0 || fee > 100) return setError("A comissão deve ficar entre 0% e 100%.");
    setError("");
    setResult(null);
    setProgress(0);
    setRunning(true);
    try {
      const next = await simulate(roundCount, betCount, stakeCents, setProgress);
      setResult(next);
    } finally {
      setRunning(false);
    }
  }

  const feeRate = Math.min(100, Math.max(0, Number(commission.replace(",", ".")) || 0)) / 100;
  const totals = result ? [
    { label: "Unidade 3x", data: result.three },
    { label: "Unidade 6x", data: result.six },
  ] : [];
  const totalBets = result ? result.rounds * result.betsPerRound : 0;

  return <section className="feature-card" aria-labelledby="game-simulator-title" style={{ maxWidth: "100%", marginBottom: 22 }}>
    <span className="feature-label">Ferramenta de análise · somente simulação</span>
    <h2 id="game-simulator-title">Simulador de sustentabilidade</h2>
    <p>Gera apostas e sorteios aleatórios de seis dígitos. Os dois cenários usam exatamente os mesmos números e resultados; somente o multiplicador da Unidade muda.</p>
    <div className="admin-round-create" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginTop: 18 }}>
      <label>Quantidade de rodadas<input type="number" min="1" max="10000" value={rounds} disabled={running} onChange={(e) => setRounds(e.target.value)} /></label>
      <label>Números por rodada<input type="number" min="1" max="1000" value={bets} disabled={running} onChange={(e) => setBets(e.target.value)} /></label>
      <label>Valor por número (R$)<input inputMode="decimal" value={stake} disabled={running} onChange={(e) => setStake(e.target.value)} /></label>
      <label>Comissão opcional (%)<input inputMode="decimal" value={commission} disabled={running} onChange={(e) => setCommission(e.target.value)} /></label>
    </div>
    <p style={{ fontSize: ".88rem" }}>Comissão é uma hipótese aplicada sobre a arrecadação total apenas para visualizar o impacto. Deixe 0% para analisar a retenção antes das comissões. Na operação real, a comissão depende do cambista e da venda.</p>
    <button type="button" className="primary-button" disabled={running} onClick={() => void run()}>{running ? "Simulando…" : "Iniciar simulação"}</button>
    {running && <div style={{ marginTop: 14 }}><p>Processando: {progress.toFixed(0)}%</p><progress value={progress} max="100" style={{ width: "100%" }} /></div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {result && <>
      <h3 style={{ marginTop: 24 }}>Resultado de {result.rounds.toLocaleString("pt-BR")} rodadas</h3>
      <p>{totalBets.toLocaleString("pt-BR")} apostas simuladas · {money(result.three.revenue)} de arrecadação em cada cenário · sorteios independentes e aleatórios.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
        {totals.map(({ label, data }) => {
          const bank = data.revenue - data.prizes;
          const commissionCents = Math.round(data.revenue * feeRate);
          const bankAfterCommission = bank - commissionCents;
          return <article key={label} className="recent-result" style={{ padding: 16 }}>
            <h3>{label}</h3>
            <p>Arrecadação: <strong>{money(data.revenue)}</strong></p>
            <p>Prêmios pagos: <strong>{money(data.prizes)}</strong></p>
            <p>Retorno aos jogadores: <strong>{percent(data.revenue ? data.prizes / data.revenue * 100 : 0)}</strong></p>
            <p>Retenção bruta da banca: <strong>{percent(data.revenue ? bank / data.revenue * 100 : 0)}</strong> ({money(bank)})</p>
            <p>Comissão estimada: {money(commissionCents)} ({percent(feeRate * 100)})</p>
            <p>Retenção após comissão: <strong>{money(bankAfterCommission)}</strong> ({percent(data.revenue ? bankAfterCommission / data.revenue * 100 : 0)})</p>
            <p>Bilhetes premiados: {data.winners.toLocaleString("pt-BR")}</p>
          </article>;
        })}
      </div>
      <h3 style={{ marginTop: 22 }}>Prêmios por categoria</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
          <thead><tr><th style={{ textAlign: "left", padding: 8 }}>Categoria</th><th style={{ textAlign: "right", padding: 8 }}>Unidade 3x</th><th style={{ textAlign: "right", padding: 8 }}>Unidade 6x</th></tr></thead>
          <tbody>{categories.map((category) => <tr key={category.key}><td style={{ padding: 8, borderTop: "1px solid var(--border)" }}>{category.label}</td><td style={{ textAlign: "right", padding: 8, borderTop: "1px solid var(--border)" }}>{money(result.three.byCategory[category.key])}</td><td style={{ textAlign: "right", padding: 8, borderTop: "1px solid var(--border)" }}>{money(result.six.byCategory[category.key])}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="note-inline">A simulação é uma amostra aleatória, não uma previsão nem garantia de resultado futuro. Para uma conclusão mais confiável, execute novamente com mais rodadas e compare a variação entre execuções. Não altera multiplicadores cadastrados nem dados reais.</p>
    </>}
  </section>;
}
