// DealerOS Document Design System — public foundation surface.
//
// Shared PDF document system built on @react-pdf/renderer (the existing approved engine), ported from
// the approved GenSpark v3.0.1 packages. This foundation provides ONLY the shared layers — no full
// document template is implemented here (the first, Estimate, lands in PHASE 12B).
//
//   Layer 1 tokens      → ./tokens
//   Layer 2 primitives  → ./primitives
//   Layer 3 components  → ./components
//   Brand / formatting  → ./brand
//   Types (incl. Brand Profile contract) → ./types
//
// All issuer identity is injected via BrandProfile (Dealer Settings) — nothing here hardcodes a
// tenant. See src/lib/pdf/register-fonts.ts for the Japanese font registration the generator invokes.

export * from "./tokens";
export * from "./types";
export * from "./brand";
export * from "./primitives";
export * from "./components";
