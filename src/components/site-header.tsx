import Image from "next/image";
import Link from "next/link";

export function SiteHeader({ linkHome = true }: { linkHome?: boolean }) {
  const brand = (
    <Image
      src="/images/brand/super-sena-header.webp"
      alt="Super Sena"
      className="site-header-scenery-image"
      width={1920}
      height={360}
      priority
      sizes="100vw"
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
