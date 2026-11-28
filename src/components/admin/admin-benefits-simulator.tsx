"use client";

import { useMemo, useState } from "react";
import { simulateBenefitsEconomics } from "@/modules/benefits/simulate-economics";

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percent = (basisPoints: number) => (basisPoints / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

function decimalToCents(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(parsed)) return Number.NaN;
  return Math.round(parsed * 100);
}

function decimalToBasisPoints(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(parsed)) return Number.NaN;
  return Math.round(parsed * 100);
}

export function AdminBenefitsSimulator() {
  const [volume, setVolume] = useState("1000");
  const [averagePurchase, setAveragePurchase] = useState("50,00");
  const [rate, setRate] = useState("2");
  const [batchSize, setBatchSize] = useState("100");
  const [winners, setWinners] = useState("1");
  const [pixFee, setPixFee] = useState("0,00");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const result = useMemo(() => {
    if (!submitted) return null;
    try {
      return simulateBenefitsEconomics({
        couponVolume: Number(volume),
        averagePurchaseCents: decimalToCents(averagePurchase),
        platformRateBasisPoints: decimalToBasisPoints(rate),
        batchSize: Number(batchSize),
        winnersPerBatch: Number(winners),
        pixPayoutFeeCents: decimalToCents(pixFee),
      });
    } catch {
      return null;
    }
  }, [submitted, volume, averagePurchase, rate, batchSize, winners, pixFee]);

  function run() {
    setSubmitted(true);
    try {
      simulateBenefitsEconomics({
        couponVolume: Number(volume),
        averagePurchaseCents: decimalToCents(averagePurchase),
        platformRateBasisPoints: decimalToBasisPoints(rate),
        batchSize: Number(batchSize),
        winnersPerBatch: Number(winners),
        pixPayoutFeeCents: decimalToCents(pixFee),
      });
      setError("");
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "";
      const messages: Record<string, string> = {
        SIMULATION_VOLUME_INVALID: "Informe de 1 a 10.000.000 cupons.",
        SIMULATION_AVERAGE_PURCHASE_INVALID: "Informe um valor médio de compra válido.",
        SIMULATION_RATE_INVALID: "O percentual deve estar entre 0% e 100%, com até duas casas decimais.",
        SIMULATION_BATCH_SIZE_INVALID: "O tamanho do lote deve ser um inteiro entre 1 e 1.000.000.",
        SIMULATION_WINNERS_INVALID: "A quantidade de ganhadores deve ser positiva e não pode superar o tamanho do lote.",
        SIMULATION_PAYOUT_FEE_INVALID: "Informe uma tarifa Pix válida e não negativa.",
        SIMULATION_TOTAL_OUT_OF_RANGE: "Os valores ultrapassam o limite numérico suportado.",
      };
      setError(messages[code] ?? "Não foi possível executar a simulação.");
    }
  }

  const fields = [
    { label: "Cupons emitidos no período", value: volume, set: setVolume, type: "number" },
    { label: "Compra média (R$)", value: averagePurchase, set: setAveragePurchase, type: "text" },
    { label: "Percentual da plataforma (%)", value: rate, set: setRate, type: "text" },
    { label: "Cupons por lote", value: batchSize, set: setBatchSize, type: "number" },
    { label: "Ganhadores por lote", value: winners, set: setWinners, type: "number" },
    { label: "Tarifa Pix por prêmio (R$)", value: pixFee, set: setPixFee, type: "text" },
  ];

  return (
    <section className="feature-card" aria-labelledby="admin-benefits-simulator-heading">
      <span className="feature-label">Ambiente externo · Sem dinheiro real</span>
      <h2 id="admin-benefits-simulator-heading">Simulador econômico de cupons</h2>
      <p>Teste cenários sem alterar lojas, cupons, lotes, regras ou pagamentos reais. A receita considera o percentual sobre o valor das compras; o prêmio considera o valor integral da compra do cupom ganhador.</p>
      <div className="admin-round-create">
        {fields.map((field) => (
          <label key={field.label}>{field.label}
            <input
              type={field.type}
              inputMode={field.type === "number" ? "numeric" : "decimal"}
              min={field.type === "number" ? "1" : undefined}
              step={field.type === "number" ? "1" : "0.01"}
              value={field.value}
              onChange={(event) => { field.set(event.target.value); setSubmitted(false); setError(""); }}
            />
          </label>
        ))}
        <div className="round-actions">
          <button type="button" onClick={run}>Calcular cenário</button>
        </div>
      </div>
      <div className="form-feedback-slot" aria-live="polite">
        {error && <p role="alert" className="note-inline form-feedback-error">{error}</p>}
      </div>
      {result && (
        <>
          <h3>Resultado estimado</h3>
          <div className="round-options">
            <article className="round-option"><strong>{money(result.purchaseVolumeCents)}</strong><br />Volume total de compras</article>
            <article className="round-option"><strong>{money(result.platformRevenueCents)}</strong><br />Receita bruta da plataforma</article>
            <article className="round-option"><strong>{money(result.expectedPrizeReserveCents)}</strong><br />Reserva estimada para prêmios</article>
            <article className="round-option"><strong>{money(result.payoutFeesCents)}</strong><br />Tarifas Pix estimadas</article>
            <article className="round-option"><strong>{money(result.estimatedBalanceCents)}</strong><br />Saldo estimado antes de impostos e despesas gerais</article>
            <article className="round-option"><strong>{percent(result.breakEvenRateBasisPoints)}</strong><br />Percentual de equilíbrio estimado</article>
          </div>
          <p>Lotes completos: <strong>{result.completeBatches.toLocaleString("pt-BR")}</strong> · Cupons restantes no lote aberto: <strong>{result.remainingCoupons.toLocaleString("pt-BR")}</strong> · Ganhadores em lotes completos: <strong>{result.prizeWinnersInCompletedBatches.toLocaleString("pt-BR")}</strong></p>
          <p className="note-inline">A reserva usa uma estimativa proporcional de ganhadores para todos os cupons, inclusive o lote incompleto, para não superestimar o saldo. O cálculo usa a mesma compra média para todos os cupons e não inclui impostos, custos fixos, chargebacks ou outras despesas não informadas. Resultado de planejamento, não garantia de lucro.</p>
        </>
      )}
    </section>
  );
}
