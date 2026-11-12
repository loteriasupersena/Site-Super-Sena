"use client";

import { useEffect, useState, type CSSProperties } from "react";
import html2canvas from "html2canvas";

import type { ThermalReceiptEntry } from "./thermal-receipt-types";
import { getReceiptRepetitionNumbers } from "./receipt-repetition";
import { createReceiptQrDataUrl } from "./receipt-qr";
export { getReceiptRepetitionNumbers } from "./receipt-repetition";
function buildReceiptHtml(article: HTMLElement): string {
  const clone = article.cloneNode(true) as HTMLElement;
  const sourceNodes = [article, ...Array.from(article.querySelectorAll<HTMLElement>("*"))];
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
  sourceNodes.forEach((source, index) => {
    const computed = window.getComputedStyle(source);
    const declarations = Array.from({ length: computed.length }, (_, propertyIndex) => computed.item(propertyIndex)).map((property) => property + ":" + computed.getPropertyValue(property) + ";").join("");
    cloneNodes[index].setAttribute("style", declarations);
  });
  const width = Math.ceil(article.getBoundingClientRect().width);
  clone.style.width = width + "px";
  clone.style.maxWidth = "none";
  clone.style.margin = "0";
  clone.style.backgroundColor = "#fff";
  return "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Recibo oficial</title><style>html,body{margin:0;padding:0;background:#fff}body{width:" + width + "px;overflow:hidden}</style></head><body>" + clone.outerHTML + "</body></html>";
}

export type ThermalReceiptProps = {
  receiptCode: string;
  paymentStatus: "CONFIRMED" | "PENDING_PAYMENT" | "CANCELLED" | "REFUNDED";
  issuedAt: string;
  totalCents: number;
  entries: ThermalReceiptEntry[];
  customerLabel?: string | null;
  cashierLabel?: string | null;
  paymentLabel?: string;
  qrCodeDataUrl?: string | null;
  onClose?: () => void;
};

/**
 * Print-ready 58 mm thermal receipt.
 * Only accepts a confirmed payment so pending purchases cannot be presented
 * as an official receipt. The verification QR code is generated locally.
 */
export function ThermalReceipt({
  receiptCode,
  paymentStatus,
  issuedAt,
  totalCents,
  entries,
  customerLabel,
  cashierLabel,
  paymentLabel = "Pagamento confirmado",
  qrCodeDataUrl,
  onClose,
}: ThermalReceiptProps) {
  const [generatedQr, setGeneratedQr] = useState<{ receiptCode: string; url: string } | null>(null);
  useEffect(() => {
    if (paymentStatus !== "CONFIRMED" || !/^SQ-[A-Z0-9]{8,32}$/.test(receiptCode)) {
      return;
    }

    const verificationUrl = window.location.origin + "/verificar-recibo/" + encodeURIComponent(receiptCode);
    let url = "";
    try {
      url = createReceiptQrDataUrl(verificationUrl);
    } catch {
      // Keep the receipt available even if local QR generation fails.
    }

    queueMicrotask(() => setGeneratedQr({ receiptCode, url }));
  }, [receiptCode, paymentStatus]);

  if (paymentStatus !== "CONFIRMED" || !/^SQ-[A-Z0-9]{8,32}$/.test(receiptCode)) return null;

  const money = (cents: number) => new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
  const issuedDate = new Date(issuedAt);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(issuedDate);
  const timeLabel = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  }).format(issuedDate);
  const date = `${dateLabel} ${timeLabel}`;
  const drawDateTime = (value: string) => {
    const drawDate = new Date(value);
    if (Number.isNaN(drawDate.getTime())) return "Horário do sorteio indisponível";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      timeZone: "America/Sao_Paulo",
    }).format(drawDate);
  };

  const qrStyle: CSSProperties = { width: 76, height: 76, objectFit: "contain" };
  const effectiveQrUrl = qrCodeDataUrl ?? (generatedQr?.receiptCode === receiptCode && generatedQr.url ? generatedQr.url : null);
  const repetitionNumbers = getReceiptRepetitionNumbers(entries);

  async function printReceipt() {
    const nativePrinter = (window as Window & {
      AndroidPrinter?: { imprimirImagemBase64?: (base64: string) => void };
    }).AndroidPrinter;
    if (!nativePrinter?.imprimirImagemBase64) {
      window.alert("A impressão gráfica não está disponível nesta versão do aplicativo.");
      return;
    }

    const article = document.getElementById("thermal-receipt-" + receiptCode);
    if (!article) return;
    const sourceQr = article.querySelector("img.thermal-receipt-qr") as HTMLImageElement | null;
    if (sourceQr && !sourceQr.complete) {
      await new Promise<void>((resolve) => {
        sourceQr.addEventListener("load", () => resolve(), { once: true });
        sourceQr.addEventListener("error", () => resolve(), { once: true });
      });
    }

    const printRoot = document.createElement("div");
    printRoot.setAttribute("aria-hidden", "true");
    printRoot.id = "thermal-receipt-print-capture";
    Object.assign(printRoot.style, {
      position: "fixed",
      left: "0",
      top: "0",
      visibility: "hidden",
      width: "384px",
      padding: "4px",
      margin: "0",
      boxSizing: "border-box",
      background: "#FFFFFF",
      color: "#000000",
      overflow: "visible",
      zIndex: "2147483647",
      pointerEvents: "none",
    });

    const printReceipt = article.cloneNode(true) as HTMLElement;
    printReceipt.removeAttribute("id");
    Object.assign(printReceipt.style, {
      display: "block",
      width: "376px",
      minWidth: "376px",
      maxWidth: "376px",
      margin: "0",
      padding: "0",
      boxSizing: "border-box",
      background: "#FFFFFF",
      color: "#000000",
      fontFamily: "Arial, Helvetica, sans-serif",
    });
    printReceipt.querySelectorAll<HTMLElement>("*").forEach((element) => {
      element.style.setProperty("color", "#000000", "important");
      element.style.setProperty("border-color", "#000000", "important");
      element.style.setProperty("box-shadow", "none", "important");
      element.style.setProperty("text-shadow", "none", "important");
      element.style.setProperty("background-color", "#FFFFFF", "important");
      element.style.setProperty("background-image", "none", "important");
      element.style.setProperty("font-family", "Arial, Helvetica, sans-serif", "important");
      element.style.setProperty("opacity", "1", "important");
    });

    const setTextStyle = (selector: string, styles: Partial<CSSStyleDeclaration>) => {
      printReceipt.querySelectorAll<HTMLElement>(selector).forEach((element) => Object.assign(element.style, styles));
    };
    setTextStyle(".thermal-receipt-brand", { fontSize: "24px", fontWeight: "700", lineHeight: "1.15" });
    setTextStyle(".thermal-receipt-header > span, .thermal-receipt-section-title, .thermal-receipt-total", {
      fontSize: "18px", fontWeight: "700", lineHeight: "1.25",
    });
    setTextStyle(".thermal-receipt-label, .thermal-receipt-code, .thermal-receipt-customer, .thermal-receipt-item, .thermal-receipt-footer", {
      fontSize: "16px", lineHeight: "1.3",
    });
    setTextStyle(".thermal-receipt-item-heading, .thermal-receipt-draw-time, .thermal-receipt-footer-code", {
      fontWeight: "700",
    });
    setTextStyle(".thermal-receipt-divider", { borderColor: "#000000", backgroundColor: "#000000" });

    const qr = printReceipt.querySelector("img.thermal-receipt-qr") as HTMLImageElement | null;
    if (qr) {
      qr.style.setProperty("width", "135px", "important");
      qr.style.setProperty("height", "135px", "important");
      qr.style.setProperty("max-width", "135px", "important");
      qr.style.setProperty("object-fit", "contain", "important");
      qr.style.setProperty("image-rendering", "pixelated", "important");
    }

    printRoot.appendChild(printReceipt);
    document.body.appendChild(printRoot);
    try {
      const canvas = await html2canvas(printRoot, {
        backgroundColor: "#FFFFFF",
        width: 384,
        windowWidth: 384,
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (clonedDocument) => {
          const captureRoot = clonedDocument.getElementById("thermal-receipt-print-capture");
          if (captureRoot) captureRoot.style.setProperty("visibility", "visible", "important");
        },
        scrollX: 0,
        scrollY: 0,
      });
      const pngBase64 = canvas.toDataURL("image/png").split(",")[1];
      if (!pngBase64) throw new Error("Não foi possível gerar a imagem do recibo.");
      nativePrinter.imprimirImagemBase64(pngBase64);
    } catch (error) {
      console.error("Falha ao preparar recibo gráfico:", error);
      window.alert(error instanceof Error ? error.message : "Não foi possível preparar a impressão.");
    } finally {
      printRoot.remove();
    }
  }

  function downloadReceipt() {
    const article = document.getElementById("thermal-receipt-" + receiptCode);
    if (!article) return;
    const html = buildReceiptHtml(article);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "recibo-" + receiptCode + ".html";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    onClose?.();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="thermal-receipt-print-root">
      <article id={`thermal-receipt-${receiptCode}`} className="thermal-receipt" aria-label={`Recibo ${receiptCode}`}>
        <header className="thermal-receipt-header">
          <strong className="thermal-receipt-brand">SUPER SENA</strong>
          <span>COMPROVANTE DE APOSTA</span>
          <span>{date}</span>
          <span className="thermal-receipt-payment">{paymentLabel}</span>
        </header>

        <section className="thermal-receipt-code-row" aria-label="Código e QR Code do recibo">
          <div className="thermal-receipt-code-copy">
            <span className="thermal-receipt-label">CÓDIGO DO RECIBO</span>
            <strong className="thermal-receipt-code">{receiptCode}</strong>
          </div>
          {effectiveQrUrl ? (
            <img className="thermal-receipt-qr" style={qrStyle} src={effectiveQrUrl} alt={`QR Code do recibo ${receiptCode}`} />
          ) : (
            <div className="thermal-receipt-qr-placeholder" aria-label="QR Code indisponível">
              QR indisponível
            </div>
          )}
        </section>

        {customerLabel && <p className="thermal-receipt-customer"><span>Cliente:</span> {customerLabel}</p>}
        {cashierLabel && <p className="thermal-receipt-customer thermal-receipt-cashier"><strong>CAMBISTA: {cashierLabel}</strong></p>}

        <div className="thermal-receipt-divider" />
        <section className="thermal-receipt-items">
          <strong className="thermal-receipt-section-title">APOSTAS</strong>
          {entries.map((entry, index) => (
            <div className="thermal-receipt-item" key={`${entry.roundCode}-${entry.numberValue}-${index}`}>
              <div className="thermal-receipt-item-heading">
                <strong>{entry.numberValue}</strong>
                <strong>{money(entry.stakeCents)}</strong>
              </div>
              <span>Repetição {repetitionNumbers[index]} · Jogo Super Sena</span>
              <span>Unidade: {money(entry.unitCents ?? 0)} · Dezena: {money(entry.tensCents ?? 0)}</span>
              <span>Centena: {money(entry.hundredsCents ?? 0)} · Quadra: {money(entry.quadraCents ?? 0)}</span>
              <span>Quina: {money(entry.quinaCents ?? 0)} · Sena: {money(entry.senaCents ?? 0)}</span>
              <strong className="thermal-receipt-draw-time">Sorteio: {drawDateTime(entry.resultAt)}</strong>
              <span>Rodada {entry.roundCode}</span>
            </div>
          ))}
        </section>

        <div className="thermal-receipt-divider" />
        <div className="thermal-receipt-total">
          <span>TOTAL PAGO</span>
          <strong>{money(totalCents)}</strong>
        </div>
        <footer className="thermal-receipt-footer">
          <strong>GUARDE ESTE COMPROVANTE</strong>
          <span>Consulte o resultado pelo código do recibo.</span>
          <span>Este recibo é um comprovante de pagamento e contém suas apostas.</span>
          <span className="thermal-receipt-footer-code">{receiptCode}</span>
        </footer>
      </article>
      <div className="thermal-receipt-actions" aria-label="Ações do recibo">
        <button className="thermal-receipt-print-button" type="button" onClick={printReceipt}>Imprimir recibo</button>
        <button className="thermal-receipt-download-button" type="button" onClick={downloadReceipt}>Baixar recibo</button>
        {onClose && <button className="thermal-receipt-exit-button" type="button" onClick={onClose}>Sair / Fechar recibo</button>}
      </div>
    </div>
  );
}
