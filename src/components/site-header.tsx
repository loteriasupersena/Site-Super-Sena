import Image from "next/image";
import Link from "next/link";

export function SiteHeader({ linkHome = true }: { linkHome?: boolean }) {
  const brand = (
    <Image
      src="/images/brand/super-sena-logo.webp"
      alt="Super Sena"
      className="site-header-scenery-image"
      width={1200}
      height={400}
      priority
      sizes="(max-width: 600px) 80vw, 60vw"
    />
  );

  return (
    <header className="site-header site-header-scenery" aria-label="Cabeçalho Super Sena">
      {linkHome ? (
        <Link className="site-header-home-link" href="/" aria-label="Ir para a página inicial">
          {brand}
        </Link>
      ) : brand}
    </header>
  );
}
