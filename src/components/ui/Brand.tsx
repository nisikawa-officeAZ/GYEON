import Image from "next/image";

interface BrandProps {
  /** Logo card edge length in px (default 40 — matches the top page sidebar). */
  size?: number;
  className?: string;
}

/**
 * Shared GYEON Detailer Agent brand lockup.
 *
 * Mirrors the canonical treatment used on the top page (public/desktop-home.html):
 * the faceted GYEON logo mark sits in a black "glass card" (so the white line-art
 * reads on the dark luxury UI), paired with the "GYEON® / DETAILER AGENT" wordmark.
 *
 * Use this everywhere the app branding appears so non-top pages stay consistent
 * with the top page. Replaces the legacy blue-square "D" placeholder.
 */
export default function Brand({ size = 40, className = "" }: BrandProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Glass logo card — black backdrop preserves the logo's native white mark */}
      <div
        className="grid place-items-center overflow-hidden flex-shrink-0 rounded-[10px]"
        style={{
          width:      size,
          height:     size,
          background: "#000",
          border:     "1px solid rgba(255,255,255,0.15)",
          boxShadow:  "0 8px 24px rgba(37,99,235,0.25), inset 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        <Image
          src="/gyeon-detailer-logo.png"
          alt="GYEON Detailer Agent"
          width={size}
          height={size}
          priority
          className="w-full h-full object-contain"
        />
      </div>

      {/* Wordmark */}
      <div className="flex flex-col leading-none">
        <span className="text-[13px] font-extrabold tracking-[3px] text-white leading-none">
          GYEON
          <sup className="text-[8px] font-normal align-super ml-0.5 text-[#4f8ef7]">®</sup>
        </span>
        <span className="mt-1 text-[9px] font-semibold uppercase leading-none tracking-[2.4px] text-[#4f8ef7]">
          Detailer Agent
        </span>
      </div>
    </div>
  );
}
