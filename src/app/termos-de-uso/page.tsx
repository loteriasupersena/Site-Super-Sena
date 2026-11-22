import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Termos de uso | Super Sena",
  description: "Regras operacionais de participação, consulta e resgate de prêmios da Super Sena.",
};

export default function TermsPage() {
  return <main className="page-shell site-page-shell"><SiteHeader /><article className="feature-card terms-page">
    <span className="feature-label">REGRAS OPERACIONAIS</span>
    <h1>Termos de uso</h1>
    <h2>Consulta e resgate de prêmios</h2>
    <p>Para prêmios de recibos físicos vendidos por cambistas, o prazo operacional para solicitar o resgate é de 7 (sete) dias corridos, contados da data e hora em que o resultado oficial da rodada for publicado no sistema.</p>
    <p>Encerrado esse prazo sem que a solicitação de resgate tenha sido registrada, o prêmio será identificado como expirado. A consulta do QR Code informará a expiração e o sistema bloqueará novas solicitações de pagamento referentes àquele prêmio.</p>
    <p>A expiração não apaga a aposta, o recibo, o resultado ou o histórico financeiro e de auditoria. Esses registros serão preservados para conferência e rastreabilidade. Prêmios já pagos ou creditados não serão marcados como não resgatados.</p>
    <p>Estas informações descrevem a regra operacional implementada na plataforma e não substituem a revisão jurídica do regulamento completo, das condições comerciais e da legislação aplicável.</p>
    <p><Link href="/">Voltar para a página inicial</Link></p>
  </article></main>;
}
