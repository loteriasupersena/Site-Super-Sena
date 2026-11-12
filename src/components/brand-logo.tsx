import Link from "next/link";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  imageStyle?: React.CSSProperties;
  label?: string;
};

/** Ícone da Super Sena para pontos da interface que exigem uma marca compacta. */
export function BrandLogo({
  className = "",
  imageClassName = "",
  imageStyle,
  label = "Super Sena — página inicial",
}: BrandLogoProps) {
  return (
    <Link href="/" className={className} aria-label={label}>
      <img
        src="/images/brand/super-sena-icon.svg"
        alt="Super Sena"
        className={imageClassName}
        style={{ display: "block", objectFit: "contain", ...imageStyle }}
      />
    </Link>
  );
}
