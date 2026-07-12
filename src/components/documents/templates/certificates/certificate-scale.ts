// Certificate front density scale.
//
// The approved concept-b certificate mocks are taller than an A4 sheet: measured in a browser at
// their authored width, the Coating front runs ~1268px and the PPF front ~1354px against a 1123px
// page. A faithful 1:1 transcription therefore cannot produce the single-page front the certificate
// must be. Rather than cut warranty terms, exclusions, or any approved wording, the two overlong
// fronts are rendered at a uniform sub-1.0 scale: every size, rule, and gap shrinks by the same
// factor, so the hierarchy (title › section heading › body › caption › footer) is preserved exactly
// and only the density changes.
//
// The scale is applied ONLY to the Coating and PPF fronts. CanCoat already fits and renders at 1.0,
// the Maintenance History back page is never scaled, and the five business documents share none of
// this — the shared design system's typography is untouched.

/** A per-document scale. 1 = the authored concept-b size. */
export type CertificateScale = number;

/**
 * Each scale is the smallest reduction that document actually needs, measured on the rendered PDF
 * rather than guessed. Coating fits from 0.97 down; 0.95 is taken because it clears the bottom
 * margin by 33pt rather than 27pt. PPF is the dense one — it still spilled at 0.95 / 0.92 / 0.91 /
 * 0.90, first fits at 0.89 with only 22pt of clearance, and is therefore set to 0.88, which clears
 * by 30pt and leaves room for a certificate carrying an extra film row.
 *
 * Nothing is cut to achieve this: every warranty term, exclusion, and legal sentence renders in
 * full, and the title › heading › body › caption › footer hierarchy scales as one.
 */
export const CERTIFICATE_FRONT_SCALE: Record<"coating" | "ppf" | "cancoat", CertificateScale> = {
  coating: 0.95,
  ppf: 0.88,
  cancoat: 1,
};

/** Scales a metric. Rounded to 1/1000pt so the output is stable across renders. */
export function scaled(scale: CertificateScale) {
  return (n: number) => Math.round(n * scale * 1000) / 1000;
}
