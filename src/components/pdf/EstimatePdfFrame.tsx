// Estimate PDF preview frame (PHASE 12H).
//
// Shows the REAL generated PDF, streamed from /pdf/estimate by the same production renderer the
// download uses. The previous preview was a hand-maintained HTML mirror of the template, which could
// silently disagree with the file the customer actually received; there is now only one renderer, so
// what is on screen IS the document.

export default function EstimatePdfFrame({ estimateId }: { estimateId: string }) {
  const src = `/pdf/estimate?estimateId=${encodeURIComponent(estimateId)}`;
  return (
    <div className="rounded-lg overflow-hidden border border-white/10 bg-white">
      <iframe
        src={src}
        title="見積書プレビュー"
        // A4 aspect ratio (210:297) so the sheet is shown whole rather than cropped.
        className="w-full block"
        style={{ aspectRatio: "210 / 297", minHeight: 640, border: 0 }}
      />
    </div>
  );
}
