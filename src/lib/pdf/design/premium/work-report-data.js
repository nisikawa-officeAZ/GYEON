/* TEMPLATE-C2-WR production data binding for the native work-report template.
 *
 * Reads window.__DEALER_OS_DOC_CONTEXT__.documentData (built server-side by
 * work-report-document-context.ts from the authenticated, eligible completion-report projection)
 * and binds it into the native DOM BEFORE work-report-paginate.js measures pagination (script order
 * guarantees this listener registers, and therefore runs, first).
 *
 * The work report is STRUCTURALLY monetary-free: the completed-work rows carry category / name /
 * description ONLY, and there is no summary or grand total to bind. This binder has no monetary
 * bindings at all.
 *
 * Safety rules:
 *  - textContent + createElement + replaceChildren only — never string-to-HTML injection.
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

    /* masthead meta: Issue Date / Work Date */
    const metaItems = Array.from(document.querySelectorAll('.doc-masthead__meta-item'));
    const metaByLabel = (label) => metaItems.find((el) => el.textContent.includes(label));
    const issueMeta = metaByLabel('Issue Date');
    if (issueMeta) issueMeta.querySelector('strong').textContent = d.issueDateDisplay || '';
    else problems.push('meta:Issue Date');
    const workMeta = metaByLabel('Work Date');
    if (workMeta) workMeta.querySelector('strong').textContent = d.workDateDisplay || '';
    else problems.push('meta:Work Date');

    /* title block document number */
    setText('.doc-title-block__docno-value', d.docNoDisplay);

    /* 01 customer */
    const parties = Array.from(document.querySelectorAll('.doc-parties-v2 .doc-party'));
    const customerParty = parties[0];
    const vehicleParty = parties[1];
    if (!customerParty || !vehicleParty) problems.push('.doc-parties-v2 .doc-party x2');
    if (customerParty) {
      const name = customerParty.querySelector('.doc-party__name');
      if (name) {
        name.textContent = d.customer.name || '';
        const hon = document.createElement('span');
        hon.className = 'honorific';
        hon.textContent = d.customer.honorific;
        name.appendChild(hon);
      }
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

    /* 04 work details — the single authored 2-column row is the structural template */
    const tbody = q('.work-report-table tbody');
    if (tbody) {
      const template = tbody.querySelector('tr');
      if (!template) problems.push('.work-report-table tbody tr(template)');
      else {
        const frag = document.createDocumentFragment();
        (d.items || []).forEach((item) => {
          const tr = template.cloneNode(true);
          const tag = tr.querySelector('.cat-tag');
          if (tag) tag.textContent = item.category || 'Other';
          const name = tr.querySelector('.work-item-name');
          if (name) name.textContent = item.name;
          const desc = tr.querySelector('.work-item-description');
          if (desc) desc.textContent = item.description || '';
          frag.appendChild(tr);
        });
        tbody.replaceChildren(frag);
      }
    }

    /* notes */
    const noteList = q('.doc-notes-v2__list');
    if (noteList) {
      noteList.replaceChildren();
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
