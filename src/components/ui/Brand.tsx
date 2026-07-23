import Image from "next/image";
import { BRAND } from "@/lib/brand/variant";

interface BrandProps {
  /** Rendered logo height in px (default 40 — matches the top page sidebar). */
  size?: number;
  className?: string;
}

/**
 * Shared app brand lockup for the active build-time variant
 * (OBSIDIAN or GYEON Classic — see src/lib/brand/variant.ts).
 *
 * Renders the variant's `combination.svg` (symbol + full name in one lockup).
 * `size` is the rendered height; width is derived from the SVG's intrinsic aspect
 * ratio so the lockup scales without distortion. Public API (default export,
 * `size`, `className`) is unchanged.
 */
export default function Brand({ size = 40, className = "" }: BrandProps) {
  const width = Math.round((size * BRAND.logo.width) / BRAND.logo.height);
  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src={BRAND.logo.combination}
        alt={BRAND.name}
        width={width}
        height={size}
        priority
        className="object-contain"
        style={{ height: size, width }}
      />
    </div>
  );
}
