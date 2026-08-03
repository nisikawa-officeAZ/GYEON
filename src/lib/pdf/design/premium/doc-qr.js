/* TEMPLATE-B1 proof: QR channel pruning driven by trusted injected context.
 * Runs before estimate-paginate.js (script order) so pagination measures the final DOM.
 * Contract (TEMPLATE-A2 missing_qr_behavior):
 *  - configured channel: render icon + generated QR + label
 *  - missing channel: remove the item entirely (no placeholder, no sample QR)
 *  - partial: remaining QRs form a right-aligned group
 *  - zero: NOTES-row QR group hidden entirely (NOTES takes full width);
 *          grand-total-row QR list kept invisible so the grand-total cell never shifts
 */
(() => {
  const apply = () => {
    const ctx = window.__DEALER_OS_DOC_CONTEXT__ || {};
    const conf = Array.isArray(ctx.qrChannels) ? ctx.qrChannels : [];
    const byLabel = new Map(conf.map((c) => [String(c.label), c]));
    document.querySelectorAll('.doc-footer-v2__qr').forEach((qr) => {
      const list = qr.querySelector('.doc-footer-v2__qr-list');
      if (!list) return;
      const items = Array.from(list.querySelectorAll('.doc-footer-v2__qr-item'));
      let kept = 0;
      items.forEach((item) => {
        const labelEl = item.querySelector('.doc-footer-v2__qr-label');
        const label = labelEl ? labelEl.textContent.trim() : '';
        const c = byLabel.get(label);
        if (!c || !c.dataUri) { item.remove(); return; }
        const img = item.querySelector('.doc-footer-v2__qr-code');
        if (img) { img.src = c.dataUri; img.alt = label + ' QR'; }
        kept += 1;
      });
      const inSummaryRow = !!qr.closest('.doc-lower__row--summary');
      if (kept === 0) {
        if (inSummaryRow) {
          qr.style.display = 'none';
          const row = qr.closest('.doc-lower__row--summary');
          if (row) row.style.gridTemplateColumns = 'minmax(0, 1fr)';
        } else { list.style.visibility = 'hidden'; }
      } else if (kept < items.length) {
        list.style.gridTemplateColumns = 'repeat(' + kept + ', minmax(0, 1fr))';
        list.style.width = 'max-content';
        list.style.marginLeft = 'auto';
      }
      document.body.dataset.qrCount = String(kept);
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }
})();
