"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export function SiteHeader({ linkHome = true }: { linkHome?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const brand = (
    <Image
      src="/images/brand/super-sena-logo.webp"
      alt="Logomarca Super Sena"
      className="site-header-scenery-image"
      width={900}
      height={386}
      priority
      sizes="(max-width: 600px) 186px, 223px"
    />
  );

  return (
    <>
      <header className="site-header site-header-scenery" aria-label="Cabeçalho Super Sena">
        {linkHome ? (
          <Link className="site-header-home-link" href="/" aria-label="Ir para a página inicial">
            {brand}
          </Link>
        ) : brand}
        <button
          className="site-header-enter"
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          Entrar
        </button>
      </header>
      {isOpen ? (
        <div className="home-access-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsOpen(false);
        }}>
          <section className="home-access-dialog" role="dialog" aria-modal="true" aria-labelledby="home-access-title">
            <button className="home-access-close" type="button" onClick={() => setIsOpen(false)} aria-label="Fechar">×</button>
            <h2 id="home-access-title">Acesse a Super Sena</h2>
            <p>Entre na sua conta ou crie seu cadastro.</p>
            <div className="home-access-options">
              <Link href="/login" className="home-access-login">Entrar</Link>
              <Link href="/cadastro" className="home-access-register">Criar conta</Link>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
