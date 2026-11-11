import Image from "next/image";
import Link from "next/link";

/** Cabeçalho compartilhado. O modo APK não oferece navegação para a página inicial. */
export function SiteHeader({ linkHome = true }: { linkHome?: boolean }) {
  const image = (
    <Image
      className="site-header-scenery-image"
      src="/images/brand/super-quina-header.webp"
      alt="Super Sena"
      width={1536}
      height={512}
      priority
      sizes="100vw"
    />
  );
  return (
    <header className="site-header site-header-scenery" aria-label="Cabeçalho Super Sena">
      {linkHome ? (
        <Link className="site-header-home-link" href="/" aria-label="Ir para a página inicial">
          {image}
        </Link>
      ) : image}
    </header>
  );
}
