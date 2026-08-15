/* B1B-E2-R1 production data binding for the native monthly-invoice template.
 *
 * Reads window.__DEALER_OS_DOC_CONTEXT__.documentData (built server-side by
 * monthly-invoice-document-data.ts from the issued statement's persisted snapshots) and binds it
 * into the native DOM BEFORE monthly-invoice-paginate.js measures pagination (script order
 * guarantees this listener registers, and therefore runs, first).
 *
 * Safety rules — identical to the accepted estimate/invoice binders:
 *  - textContent only; no HTML interpolation of document data anywhere.
 *  - values arrive pre-formatted; nothing is computed here.
 *  - absent optional fields REMOVE their row/element ("omitted, never invented").
 *  - any missing required bind target marks documentElement[data-doc-data-error] so the server
 *    renderer fails closed instead of shipping a half-bound document.
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

    /* masthead meta: Issue Date / Closing Date / Payment Due (Currency stays as authored) */
    const metaItems = Array.from(document.querySelectorAll('.doc-masthead__meta-item'));
    const metaByLabel = (label) => metaItems.find((el) => el.textContent.includes(label));
    const bindMeta = (label, value) => {
      const meta = metaByLabel(label);
      if (!meta) { problems.push('meta:' + label); return; }
      if (value) meta.querySelector('strong').textContent = value;
      else meta.remove();
    };
    bindMeta('Issue Date', d.issueDateDisplay);
    bindMeta('Closing Date', d.closingDateDisplay);
    bindMeta('Payment Due', d.paymentDueDisplay);

    /* title block: statement number + billing period */
    setText('.doc-title-block__docno-value', d.docNoDisplay);
    setText('.monthly-period', d.periodDisplay);

    /* 01 billing to */
    const parties = Array.from(document.querySelectorAll('.doc-parties-v2 .doc-party'));
    const customerParty = parties[0];
    if (!customerParty) problems.push('.doc-parties-v2 .doc-party(customer)');
    if (customerParty) {
      const custName = customerParty.querySelector('.doc-party__name');
      if (custName) {
        custName.textContent = d.customer.name || '';
        const hon = document.createElement('span');
        hon.className = 'honorific';
        hon.textContent = d.customer.honorific;
        custName.appendChild(hon);
      } else problems.push('customer .doc-party__name');
      const addr = customerParty.querySelector('.doc-party__addr');
      if (addr) {
        addr.textContent = '';
        if (d.customer.postalCode) {
          addr.append('〒' + d.customer.postalCode);
          addr.appendChild(document.createElement('br'));
        }
        addr.append(d.customer.address || '');
      }
      customerParty.querySelectorAll('.doc-party__dl dt').forEach((dt) => {
        const dd = dt.nextElementSibling;
        const label = dt.textContent.trim();
        const value = label === 'TEL' ? d.customer.tel : label === 'Email' ? d.customer.email : undefined;
        if (!value) { dt.remove(); if (dd) dd.remove(); return; }
        if (dd) dd.textContent = value;
      });
    }

    /* 03 monthly billing detail — the single authored row is the structural template.
     * Exactly four main columns: 納品日 / 車両 / 作業内容 / 金額税込.
     * The invoice number appears ONLY as the subline inside 作業内容. */
    const tbody = q('.doc-table-v2 tbody');
    if (tbody) {
      const template = tbody.querySelector('tr');
      if (!template) problems.push('.doc-table-v2 tbody tr(template)');
      else {
        const frag = document.createDocumentFragment();
        (d.rows || []).forEach((row) => {
          const tr = template.cloneNode(true);
          const cells = tr.children;
          cells[0].textContent = row.deliveryDateDisplay;
          const vName = cells[1].querySelector('.rich-cell__name');
          if (vName) { if (row.vehicleName) vName.textContent = row.vehicleName; else { vName.textContent = '—'; } }
          const vPlate = cells[1].querySelector('.rich-cell__desc');
          if (vPlate) { if (row.vehiclePlate) vPlate.textContent = row.vehiclePlate; else vPlate.remove(); }
          const wName = cells[2].querySelector('.rich-cell__name');
          if (wName) wName.textContent = row.workDescription;
          const wNo = cells[2].querySelector('.rich-cell__desc');
          if (wNo) { if (row.invoiceNoDisplay) wNo.textContent = row.invoiceNoDisplay; else wNo.remove(); }
          cells[3].className = 'num subtotal';
          cells[3].textContent = row.amountDisplay;
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

    /* summary rows are addressed by data-summary-key, never by position */
    const summaryValue = (key) => {
      const row = document.querySelector('.doc-summary-v2__row[data-summary-key="' + key + '"]');
      if (!row) { problems.push('summary:' + key); return null; }
      return row.querySelector('.doc-summary-v2__value');
    };
    const bindSummary = (key, display, { negative = false, dashWhenAbsent = true } = {}) => {
      const el = summaryValue(key);
      if (!el) return;
      if (display) {
        if (negative) el.classList.add('negative');
        el.textContent = display;
      } else if (dashWhenAbsent) {
        el.classList.remove('negative');
        el.textContent = '—';
      }
    };
    bindSummary('opening', d.summary.openingDisplay, { dashWhenAbsent: false });
    bindSummary('subtotal', d.summary.subtotalDisplay, { dashWhenAbsent: false });
    bindSummary('discount', d.summary.discountDisplay, { negative: !!d.summary.discountDisplay });
    bindSummary('tax', d.summary.taxDisplay, { dashWhenAbsent: false });
    bindSummary('current-total', d.summary.currentTotalDisplay, { dashWhenAbsent: false });
    bindSummary('payments', d.summary.paymentsReceivedDisplay, { negative: !!d.summary.paymentsReceivedDisplay });
    bindSummary('adjustments', d.summary.adjustmentsDisplay, { negative: (d.summary.adjustmentsDisplay || '').startsWith('−') });

    /* grand total = the persisted closing balance (今回ご請求額) */
    setText('.doc-grand-total__value', d.summary.closingDisplay);

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
