import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { HomeAccess } from "@/components/home-access";

export const metadata: Metadata = {
  title: "Super Sena | Sua chance começa aqui",
  description: "Conheça a Super Sena, confira as cinco faixas de premiação e descubra como jogar. Sorteios a cada 30 minutos.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

const prizes = [
  { name: "Dezena", match: "2 últimos números", multiplier: "20x", detail: "Acerte os dois últimos dígitos." },
  { name: "Centena", match: "3 últimos números", multiplier: "200x", detail: "Acerte os três últimos dígitos." },
  { name: "Milhar", match: "4 últimos números", multiplier: "2.000x", detail: "Acerte os quatro últimos dígitos." },
  { name: "Quina", match: "5 últimos números", multiplier: "20.000x", detail: "Acerte os cinco últimos dígitos." },
  { name: "Sena", match: "6 números", multiplier: "200.000x", detail: "Acerte os seis dígitos do resultado." },
];

const steps = [
  { number: "01", title: "Escolha seus números", description: "Monte sua aposta com seis dígitos e escolha o valor que deseja jogar." },
  { number: "02", title: "Confirme sua aposta", description: "Revise os dados e conclua sua compra pelo canal disponível." },
  { number: "03", title: "Confira o resultado", description: "Consulte seu bilhete e veja se algum dos cinco prêmios foi contemplado." },
];

const whatsappUrl = "https://wa.me/5577991601217?text=Quero%20informa%C3%A7%C3%B5es%20sobre%20o%20credenciamento%20de%20cambista%20da%20Super%20Sena.";

export default function HomePage() {
  return (
    <div className="home-page home-page-compact landing-page">
      <HomeAccess />
      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <span className="landing-kicker"><span aria-hidden="true" /> Sorteios a cada 30 minutos</span>
            <p className="landing-overline">A emoção de jogar. A facilidade de conferir.</p>
            <h1 id="landing-title">Sua sorte tem <span>seis dígitos.</span></h1>
            <p className="landing-lead">Escolha seu número, participe e acompanhe os resultados da Super Sena com praticidade.</p>
            <div className="landing-actions">
              <Link className="landing-button landing-button-primary" href="/login">Quero jogar</Link>
              <Link className="landing-button landing-button-outline" href="/consulta">Conferir meu bilhete</Link>
            </div>
            <p className="landing-hero-note">Jogue com responsabilidade. Confira sempre as regras e condições da sua aposta.</p>
          </div>
          <div className="landing-hero-art" aria-label="Identidade visual da Super Sena">
            <div className="landing-orbit landing-orbit-one" />
            <div className="landing-orbit landing-orbit-two" />
            <div className="landing-brand-card">
              <Image src="/images/brand/super-sena-icone.webp" alt="Símbolo Super Sena" width={230} height={230} priority />
              <span>SUPER SENA</span>
              <strong>6 DÍGITOS</strong>
            </div>
            <span className="landing-floating-number landing-floating-number-one">20x</span>
            <span className="landing-floating-number landing-floating-number-two">200.000x</span>
          </div>
        </section>

        <section className="landing-section landing-prizes" id="premios" aria-labelledby="prizes-title">
          <div className="landing-section-heading">
            <span className="landing-section-eyebrow">Cinco formas de ganhar</span>
            <h2 id="prizes-title">Conheça os prêmios</h2>
            <p>O resultado tem seis dígitos e você concorre em cinco faixas de premiação.</p>
          </div>
          <div className="landing-prize-grid">
            {prizes.map((prize, index) => (
              <article className="landing-prize-card" key={prize.name}>
                <span className="landing-prize-index">0{index + 1}</span>
                <span className="landing-prize-multiplier">{prize.multiplier}</span>
                <h3>{prize.name}</h3>
                <p className="landing-prize-match">{prize.match}</p>
                <p>{prize.detail}</p>
              </article>
            ))}
          </div>
          <p className="landing-prize-footnote">Multiplicadores conforme as regras atuais do jogo. O valor do prêmio depende do valor destinado à categoria na aposta.</p>
        </section>

        <section className="landing-section landing-how" id="como-jogar" aria-labelledby="how-title">
          <div className="landing-section-heading">
            <span className="landing-section-eyebrow">Simples e direto</span>
            <h2 id="how-title">Como jogar</h2>
            <p>Três passos para participar da Super Sena.</p>
          </div>
          <div className="landing-steps">
            {steps.map((step) => (
              <article className="landing-step-card" key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
          <div className="landing-how-action">
            <Link className="landing-button landing-button-primary" href="/login">Acessar minha conta</Link>
            <Link className="landing-text-link" href="/consulta">Já tem um bilhete? Confira aqui</Link>
          </div>
        </section>

        <section className="landing-cashier" aria-labelledby="cashier-title">
          <div className="landing-cashier-copy">
            <span className="landing-section-eyebrow">Faça parte da nossa rede</span>
            <h2 id="cashier-title">Seja um cambista credenciado</h2>
            <p>Quer trabalhar com a Super Sena? Fale com nossa equipe e saiba como realizar seu credenciamento.</p>
            <a className="landing-button landing-button-whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.4-4.7a8.5 8.5 0 1 1 16.1-4Zm-8.5-7a7 7 0 0 0-6 10.6l.2.3-.8 2.7 2.8-.8.3.2a7 7 0 1 0 3.5-13Zm3.9 10.1c-.2-.1-1.2-.6-1.4-.7s-.3-.1-.5.1-.5.7-.7.8-.3.2-.5.1a5.8 5.8 0 0 1-1.7-1.1 6.4 6.4 0 0 1-1.2-1.5c-.1-.2 0-.3.1-.4l.3-.4.2-.3v-.3l-.6-1.4c-.2-.4-.3-.4-.5-.4h-.4c-.2 0-.4.1-.6.3s-.8.8-.8 1.9.8 2.2.9 2.4a9.5 9.5 0 0 0 3.7 3.3c.5.2.9.4 1.2.4.5.1 1 .1 1.4-.1.4-.2 1.2-.5 1.3-1 .2-.5.2-.9.1-1-.1-.1-.2-.1-.4-.2Z" /></svg>
              Falar pelo WhatsApp
            </a>
            <span className="landing-whatsapp-number">WhatsApp: (77) 99160-1217</span>
          </div>
          <div className="landing-cashier-mark" aria-hidden="true">
            <span>SS</span>
            <strong>REDE CREDENCIADA</strong>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <Image src="/images/brand/super-sena-icone.webp" alt="" width={34} height={34} />
        <span>Super Sena</span>
        <span className="landing-footer-separator">•</span>
        <Link href="/termos-de-uso">Termos de uso</Link>
        <span className="landing-footer-copy">© {new Date().getFullYear()} Super Sena. Todos os direitos reservados.</span>
      </footer>
    </div>
  );
}
