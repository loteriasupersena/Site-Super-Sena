import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MEU VALE PIX | Promoções para consumidores e lojas",
  description: "Plataforma de cupons promocionais com QR Code para estabelecimentos comerciais.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return (
    <main className="home-page">
      <header className="site-header">
        <Link href="/" aria-label="MEU VALE PIX">MEU VALE PIX</Link>
        <Link href="/cashier-app-login">Acesso da maquininha</Link>
      </header>
      <section className="home-entry">
        <p className="eyebrow">Promoções para o comércio</p>
        <h1>MEU VALE PIX</h1>
        <p>Uma plataforma de cupons promocionais com QR Code para conectar lojas e consumidores.</p>
        <p>A cada compra elegível, a loja emite um cupom. O consumidor consulta o cupom pelo QR Code e acompanha se foi contemplado.</p>
      </section>
    </main>
  );
}
