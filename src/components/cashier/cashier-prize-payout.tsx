"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type PrizeLine = {
  id: string;
  numberValue: string;
  roundCode: string;
  roundCompleted: boolean;
  resultNumber: string | null;
  resultAt: string;
  stakeCents: number;
  prizeCategoryLabel: string | null;
  categoryStakeCents: number | null;
  multiplier: number | null;
  calculatedPrizeCents: number | null;
  calculationConsistent: boolean;
  participationTotalCents: number;
  purchaseTotalCents: number;
  prizeCents: number;
  paid: boolean;
  payoutChannel: "PLATFORM_PIX" | "CASHIER_CASH" | "WALLET" | null;
  paidAt: string | null;
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function receiptCodeFromQr(value: string): string | null {
  const directCode = value.trim().match(/^SQ-[A-Z0-9]{8,32}$/i)?.[0];
  if (directCode) return directCode.toUpperCase();

  try {
    const url = new URL(value);
    if (url.origin !== window.location.origin) return null;
    const match = url.pathname.match(/^\/verificar-recibo\/(SQ-[A-Z0-9]{8,32})\/?$/i);
    return match?.[1]?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

export function CashierPrizePayout() {
  const [receiptCode, setReceiptCode] = useState("");
  const [lines, setLines] = useState<PrizeLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyLine, setBusyLine] = useState("");
  const [confirmLine, setConfirmLine] = useState<PrizeLine | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function stopScanner() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function lookup(code: string) {
    setLoading(true);
    setError("");
    setMessage("");
    setLines([]);
    setReceiptCode(code);
    try {
      const response = await fetch("/api/cashier/prizes/lookup?q=" + encodeURIComponent(code), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível consultar o recibo.");
      setLines(body.lines as PrizeLine[]);
      setMessage(body.lines.length ? "Recibo localizado." : "Este recibo não possui apostas confirmadas.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao consultar o recibo.");
    } finally {
      setLoading(false);
    }
  }

  async function startScanner() {
    setError("");
    setMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador não permite acessar a câmera. Abra o site em um navegador atualizado e com HTTPS.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setScanning(false);
        return;
      }
      video.srcObject = stream;
      await video.play();
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Não foi possível iniciar a leitura da câmera.");

      let lastScanAt = 0;
      const scan = (now: number) => {
        if (!streamRef.current || !videoRef.current) return;
        if (now - lastScanAt >= 180 && video.videoWidth > 0 && video.videoHeight > 0) {
          lastScanAt = now;
          const width = Math.min(video.videoWidth, 960);
          const height = Math.round(video.videoHeight * (width / video.videoWidth));
          canvas.width = width;
          canvas.height = height;
          context.drawImage(video, 0, 0, width, height);
          const image = context.getImageData(0, 0, width, height);
          const result = jsQR(image.data, width, height, { inversionAttempts: "dontInvert" });
          if (result) {
            const code = receiptCodeFromQr(result.data);
            stopScanner();
            if (code) void lookup(code);
            else setError("QR Code inválido. Aponte a câmera para o QR Code de um recibo Super Sena.");
            return;
          }
        }
        frameRef.current = requestAnimationFrame(scan);
      };
      frameRef.current = requestAnimationFrame(scan);
    } catch (reason) {
      stopScanner();
      const errorName = reason instanceof DOMException ? reason.name : "";
      setError(errorName === "NotAllowedError"
        ? "Permita o acesso à câmera nas configurações do navegador para ler o QR Code."
        : errorName === "NotFoundError"
          ? "Nenhuma câmera foi encontrada neste aparelho."
          : "Não foi possível acessar a câmera. Verifique a permissão e tente novamente.");
    }
  }

  async function pay(lineId: string) {
    setBusyLine(lineId);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/cashier/prizes/" + encodeURIComponent(lineId) + "/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível registrar o pagamento.");
      setLines((current) => current.map((line) => line.id === lineId
        ? { ...line, paid: true, payoutChannel: "CASHIER_CASH", paidAt: body.payout.paidAt }
        : line));
      setMessage("Prêmio pago e registrado no financeiro.");
      setConfirmLine(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao registrar o pagamento.");
    } finally {
      setBusyLine("");
    }
  }

  return <section className="player-collapsible-section cashier-prize-payout" aria-label="Pagamento de prêmios em dinheiro">
    <div className="cashier-prize-payout-heading">
      <span className="player-collapsible-label">Premiações</span>
    </div>

    <div className="cashier-qr-scanner">
      <div className="cashier-qr-camera" hidden={!scanning}>
        <video ref={videoRef} muted playsInline aria-label="Câmera para leitura do QR Code" />
        <p>Aponte a câmera para o QR Code do recibo.</p>
        <button type="button" className="cashier-qr-cancel" onClick={stopScanner}>Cancelar leitura</button>
      </div>
      {!scanning && <button type="button" className="cashier-qr-start" onClick={() => void startScanner()} disabled={loading}>
        {loading ? "Consultando recibo…" : "Ler QR Code do recibo"}
      </button>}
      <canvas ref={canvasRef} className="cashier-qr-canvas" aria-hidden="true" />
    </div>

    {receiptCode && <p className="cashier-prize-receipt-code">Recibo: <strong>{receiptCode}</strong></p>}
    {error && <p role="alert" className="note-inline cashier-prize-feedback">{error}</p>}
    {message && <p role="status" className="note-inline cashier-prize-feedback">{message}</p>}

    {lines.length > 0 && <div className="cashier-prize-lines">
      {lines.map((line) => {
        const status = !line.roundCompleted
          ? "Aguardando sorteio"
          : line.prizeCents > 0
            ? line.paid ? "Pago" : "Premiada"
            : "Não premiada";
        return <article className="cashier-prize-line" key={line.id}>
          <div className="cashier-prize-line-info">
            <div className="cashier-prize-line-heading">
              <strong className="cashier-prize-number">{line.numberValue}</strong>
              <span className={!line.roundCompleted ? "cashier-prize-status is-pending" : line.prizeCents > 0 ? "cashier-prize-status is-winner" : "cashier-prize-status is-loser"}>{status}</span>
            </div>
            <p>Rodada {line.roundCode} · Aposta {money(line.stakeCents)}</p>
            {line.roundCompleted && line.prizeCents > 0 && <>
              <p>{line.prizeCategoryLabel ?? "Prêmio"} · <strong>{money(line.prizeCents)}</strong></p>
              {!line.calculationConsistent && <p role="alert" className="cashier-prize-review">Pagamento bloqueado: cálculo em revisão.</p>}
            </>}
          </div>
          {line.roundCompleted && line.prizeCents > 0 && !line.paid && line.calculationConsistent && (
            <button type="button" className="cashier-prize-pay-button" onClick={() => setConfirmLine(line)} disabled={Boolean(busyLine)}>Pagar</button>
          )}
        </article>;
      })}
    </div>}

    {confirmLine && <div className="modal-backdrop cashier-prize-confirm-backdrop">
      <section className="modal-panel cashier-prize-confirm" role="dialog" aria-modal="true" aria-labelledby="cashier-prize-confirm-title">
        <h3 id="cashier-prize-confirm-title">Confirma o pagamento deste prêmio?</h3>
        <p>{confirmLine.numberValue} · {money(confirmLine.prizeCents)}</p>
        <div className="cashier-prize-confirm-actions">
          <button type="button" className="cashier-prize-confirm-cancel" onClick={() => setConfirmLine(null)} disabled={Boolean(busyLine)}>Cancelar</button>
          <button type="button" className="cashier-prize-confirm-submit" onClick={() => void pay(confirmLine.id)} disabled={Boolean(busyLine)}>{busyLine === confirmLine.id ? "Confirmando…" : "Confirmar"}</button>
        </div>
      </section>
    </div>}
  </section>;
}
