/* TEMPLATE-C2-DN production data binding for the native delivery-note template.
 *
 * Reads window.__DEALER_OS_DOC_CONTEXT__.documentData (built server-side by
 * delivery-note-document-context.ts from the authenticated, eligible issued-invoice projection) and binds it into the
 * accepted DOM BEFORE delivery-note-paginate.js measures pagination (script order guarantees this
 * listener registers, and therefore runs, first).
 *
 * Safety rules:
 *  - textContent only — no HTML interpolation of document data anywhere.
 *  - values are bound as pre-formatted display strings; nothing is computed here.
 *  - absent optional fields REMOVE their row/element ("omitted, never invented").
 *  - any missing required bind target marks documentElement[data-doc-data-error] so the
 *    server renderer fails closed instead of shipping a half-bound document.
 */
(() => {
  const bind = () => {
    const ctx = window.__DEALER_OS_DOC_CONTEXT__ || {};
    const d = ctx.documentData;
    if (!d) {
      document.documentElement.setAttribute('data-doc-data-error', 'missing-document-data');
      return;
    }
    const problems = [];
    const q = (sel) => {
      const el = document.querySelector(sel);
      if (!el) problems.push(sel);
      return el;
    };
    const setText = (sel, value) => {
      const el = q(sel);
      if (el) el.textContent = value == null ? '' : String(value);
      return el;
    };

    /* masthead meta: Issue Date / Delivery Date (Currency stays as authored) */
    const metaItems = Array.from(document.querySelectorAll('.doc-masthead__meta-item'));
    const metaByLabel = (label) => metaItems.find((el) => el.textContent.includes(label));
    const issueMeta = metaByLabel('Issue Date');
    if (issueMeta) {
      if (d.issueDateDisplay) issueMeta.querySelector('strong').textContent = d.issueDateDisplay;
      else issueMeta.remove();
    }
    const deliveryMeta = metaByLabel('Delivery Date');
    if (deliveryMeta) deliveryMeta.querySelector('strong').textContent = d.deliveryDateDisplay || '';
    else problems.push('meta:Delivery Date');

    /* title block document number */
    setText('.doc-title-block__docno-value', d.docNoDisplay);

    /* 01 customer */
    const custName = q('.doc-parties-v2 .doc-party:not(.doc-party--issuer) .doc-party__name');
    if (custName) {
      custName.textContent = d.customer.name || '';
      const hon = document.createElement('span');
      hon.className = 'honorific';
      hon.textContent = d.customer.honorific;
      custName.appendChild(hon);
    }
    const parties = Array.from(document.querySelectorAll('.doc-parties-v2 .doc-party'));
    const customerParty = parties[0];
    const vehicleParty = parties[1];
    if (!customerParty || !vehicleParty) problems.push('.doc-parties-v2 .doc-party x2');
    if (customerParty) {
      const addr = customerParty.querySelector('.doc-party__addr');
      if (addr) {
        addr.textContent = '';
        if (d.customer.postalCode) {
          addr.append('〒' + d.customer.postalCode);
          addr.appendChild(document.createElement('br'));
        }
        addr.append(d.customer.address || '');
      }
      const rows = customerParty.querySelectorAll('.doc-party__dl dt');
      rows.forEach((dt) => {
        const dd = dt.nextElementSibling;
        const label = dt.textContent.trim();
        const value = label === 'TEL' ? d.customer.tel : label === 'Email' ? d.customer.email : undefined;
        if (!value) { dt.remove(); if (dd) dd.remove(); return; }
        if (dd) dd.textContent = value;
      });
    }

    /* 02 vehicle */
    if (vehicleParty) {
      const vname = vehicleParty.querySelector('.doc-party__name');
      if (vname) vname.textContent = d.vehicle.name || '';
      const map = {
        'メーカー': d.vehicle.maker,
        '年式': d.vehicle.yearDisplay,
        'グレード': d.vehicle.grade,
        'ナンバー': d.vehicle.plate,
        'ボディカラー': d.vehicle.color,
        '走行距離': d.vehicle.mileage,
      };
      vehicleParty.querySelectorAll('.doc-party__dl dt').forEach((dt) => {
        const dd = dt.nextElementSibling;
        const value = map[dt.textContent.trim()];
        if (!value) { dt.remove(); if (dd) dd.remove(); return; }
        if (dd) dd.textContent = value;
      });
    }

    /* 04 items — first authored row is the structural template; real rows replace all rows */
    const tbody = q('.doc-table-v2 tbody');
    if (tbody) {
      const template = tbody.querySelector('tr');
      if (!template) problems.push('.doc-table-v2 tbody tr(template)');
      else {
        const frag = document.createDocumentFragment();
        (d.items || []).forEach((item) => {
          const tr = template.cloneNode(true);
          const cells = tr.children;
          const tag = cells[0].querySelector('.cat-tag');
          if (tag) tag.textContent = item.category || 'Other';
          const name = cells[1].querySelector('.rich-cell__name');
          if (name) name.textContent = item.name;
          const desc = cells[1].querySelector('.rich-cell__desc');
          if (desc) { if (item.description) desc.textContent = item.description; else desc.remove(); }
          cells[2].textContent = item.unitPriceDisplay;
          cells[3].textContent = item.quantityDisplay;
          if (item.discountDisplay) { cells[4].className = 'num discount-val'; cells[4].textContent = item.discountDisplay; }
          else { cells[4].className = 'dash'; cells[4].textContent = '—'; }
          cells[5].className = 'num subtotal';
          cells[5].textContent = item.amountDisplay;
          frag.appendChild(tr);
        });
        tbody.textContent = '';
        tbody.appendChild(frag);
      }
    }

    /* notes */
    const noteList = q('.doc-notes-v2__list');
    if (noteList) {
      noteList.textContent = '';
      (d.notes || []).forEach((note, i) => {
        const row = document.createElement('div');
        row.className = 'note-row';
        const no = document.createElement('span');
        no.className = 'note-no';
        no.textContent = String(i + 1).padStart(2, '0');
        const txt = document.createElement('span');
        txt.className = 'note-text';
        txt.textContent = note;
        row.append(no, txt);
        noteList.appendChild(row);
      });
    }

    /* summary + grand total */
    const summaryRows = Array.from(document.querySelectorAll('.doc-summary-v2__row'));
    if (summaryRows.length !== 3) problems.push('.doc-summary-v2__row x3');
    else {
      summaryRows[0].querySelector('.doc-summary-v2__value').textContent = d.summary.subtotalDisplay;
      const dv = summaryRows[1].querySelector('.doc-summary-v2__value');
      if (d.summary.discountDisplay) { dv.classList.add('negative'); dv.textContent = d.summary.discountDisplay; }
      else { dv.classList.remove('negative'); dv.textContent = '—'; }
      const taxEn = summaryRows[2].querySelector('.doc-summary-v2__label-en');
      if (taxEn) taxEn.textContent = d.summary.taxLabelEn;
      summaryRows[2].querySelector('.doc-summary-v2__value').textContent = d.summary.taxDisplay;
    }
    setText('.doc-grand-total__value', d.summary.grandTotalDisplay);

    /* serial footer */
    setText('.doc-serial__hash', d.serialHashDisplay);

    if (problems.length) {
      document.documentElement.setAttribute('data-doc-data-error', problems.join(','));
    } else {
      document.documentElement.setAttribute('data-doc-data-ready', '1');
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
