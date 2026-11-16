import Image from "next/image";
import Link from "next/link";

export function SiteHeader({ linkHome = true, showLogin = false }: { linkHome?: boolean; showLogin?: boolean }) {
  const brand = (
    <Image
      src="/images/brand/super-sena-logo.webp"
      alt="Logomarca Super Sena"
      className="site-header-scenery-image"
      width={900}
      height={386}
      priority
      sizes="(max-width: 600px) 80vw, 260px"
    />
  );

  return (
    <header className="site-header site-header-scenery" aria-label="Cabeçalho Super Sena">
      {linkHome ? (
        <Link className="site-header-home-link" href="/" aria-label="Ir para a página inicial">
          {brand}
        </Link>
      ) : brand}
      {showLogin && (
        <Link className="site-header-login" href="/login" aria-label="Entrar na Super Sena">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="4.5" r="2.5" />
            <path d="M2.8 14c.25-2.7 2.25-4.2 5.2-4.2s4.95 1.5 5.2 4.2z" />
          </svg>
          <span>Entrar</span>
        </Link>
      )}
    </header>
  );
}
