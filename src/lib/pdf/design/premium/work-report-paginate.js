/* TEMPLATE-C2-WR — work-report pagination. Byte-derived from the accepted production
 * pagination (DOM-measurement, fonts.ready gate, replaceChildren clear, no URL params, no fixed
 * capacities). The estimate-single-page-fit / estimate-pagination-ready class names are the SHARED
 * contract used by the vendored CSS and the Chromium renderer ready-gate. */
(() => {
  const formatPage = (n) => String(n).padStart(2, '0');
  const pageLabel = (page, total) => `Page ${formatPage(page)} / ${formatPage(total)}`;
  const clone = (node) => node.cloneNode(true);
  const getRows = () => Array.from(document.querySelectorAll('.doc-table-v2 tbody tr'));

  const setItemCount = (page, count) => {
    const meta = page.querySelector('.doc-section-heading__meta');
    if (meta) meta.textContent = `${count} items`;
  };

  const updatePageNumbers = () => {
    const pages = Array.from(document.querySelectorAll('.doc-page-v2'));
    const total = pages.length;
    pages.forEach((page, idx) => {
      const el = page.querySelector('.doc-serial__page');
      if (el) el.textContent = pageLabel(idx + 1, total);
    });
  };



  const createMeasureRoot = () => {
    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.left = '-10000px';
    root.style.top = '0';
    root.style.width = '210mm';
    root.style.visibility = 'hidden';
    root.style.pointerEvents = 'none';
    document.body.appendChild(root);
    return root;
  };

  const createPageFactory = (templates, totalCount) => ({ continued, final, rowsChunk, measure = false }) => {
    const page = document.createElement('article');
    page.className = 'doc-page-v2' + (continued ? ' doc-page-v2--continued' : '') + (final ? ' doc-page-v2--final' : '');
    page.appendChild(clone(templates.edge));
    page.appendChild(clone(templates.masthead));

    if (!continued) {
      page.appendChild(clone(templates.title));
      page.appendChild(clone(templates.parties));
    }

    const section = clone(templates.tableSection);
    const tbody = section.querySelector('tbody');
    tbody.replaceChildren();
    rowsChunk.forEach((row) => tbody.appendChild(clone(row)));
    const thead = section.querySelector('thead');
    if (thead) thead.style.display = 'table-header-group';
    setItemCount(section, totalCount);
    page.appendChild(section);

    if (final) {
      page.appendChild(clone(templates.lower));
      page.appendChild(clone(templates.pageTail));
    } else {
      const spacer = document.createElement('div');
      spacer.style.flex = '1 1 auto';
      page.appendChild(spacer);
      page.appendChild(clone(templates.serial));
    }

    if (measure) {
      page.style.height = '297mm';
      page.style.minHeight = '297mm';
      page.style.maxHeight = '297mm';
      page.style.overflow = 'hidden';
      page.style.margin = '0';
      page.style.boxShadow = 'none';
    }

    return page;
  };

  const fitsPage = (measureRoot, page) => {
    measureRoot.appendChild(page);
    const fits = page.scrollHeight <= page.clientHeight + 1;
    page.remove();
    return fits;
  };

  const getCapacities = (measureRoot, makePage, rows, totalCount) => {
    const maxFit = (continued, final) => {
      let fit = 0;
      for (let i = 1; i <= rows.length; i += 1) {
        const page = makePage({ continued, final, rowsChunk: rows.slice(0, i), measure: true });
        if (fitsPage(measureRoot, page)) fit = i;
        else break;
      }
      return fit;
    };

    return {
      single: maxFit(false, true),
      first: maxFit(false, false),
      middle: maxFit(true, false),
      final: maxFit(true, true)
    };
  };

  const planPages = (rows, caps) => {
    const total = rows.length;
    if (total <= caps.single) {
      return [{ continued: false, final: true, count: total }];
    }

    if (total <= caps.first + caps.final) {
      const preferred = [12, 11];
      for (const first of preferred) {
        const tail = total - first;
        if (first <= caps.first && tail > 0 && tail <= caps.final) {
          return [
            { continued: false, final: false, count: first },
            { continued: true, final: true, count: tail }
          ];
        }
      }

      for (let first = Math.min(caps.first, total - 1); first >= 1; first -= 1) {
        const tail = total - first;
        if (tail > 0 && tail <= caps.final) {
          return [
            { continued: false, final: false, count: first },
            { continued: true, final: true, count: tail }
          ];
        }
      }
    }

    const plan = [];
    let remaining = total;
    let firstCount = Math.min(caps.first, remaining);
    plan.push({ continued: false, final: false, count: firstCount });
    remaining -= firstCount;

    while (remaining > caps.final) {
      const middleCount = Math.min(caps.middle, remaining - caps.final);
      plan.push({ continued: true, final: false, count: middleCount });
      remaining -= middleCount;
    }

    plan.push({ continued: true, final: true, count: remaining });
    return plan;
  };

  const init = async () => {
    if (window.__dealerBrandReadyPromise) await window.__dealerBrandReadyPromise;
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
    const original = document.querySelector('.doc-page-v2');
    if (!original) return;

    const templates = {
      edge: original.querySelector('.doc-edge'),
      masthead: original.querySelector('.doc-masthead'),
      title: original.querySelector('.doc-title-block'),
      parties: original.querySelector('.doc-parties-v2'),
      tableSection: Array.from(original.querySelectorAll('section')).find((s) => s.querySelector('.doc-table-v2')),
      lower: original.querySelector('.doc-lower'),
      pageTail: original.querySelector('.doc-page-tail'),
      serial: original.querySelector('.doc-serial')
    };

    const templateRows = getRows();
    setItemCount(original, templateRows.length);

    const rows = getRows();
    document.body.dataset.itemCount = String(rows.length);

    const measureRoot = createMeasureRoot();
    const makePage = createPageFactory(templates, rows.length);
    const caps = getCapacities(measureRoot, makePage, rows, rows.length);
    measureRoot.remove();

    if (rows.length <= caps.single) {
      document.body.classList.add('estimate-single-page-fit');
      updatePageNumbers();
      document.documentElement.classList.add('estimate-pagination-ready');
      return;
    }

    const plan = planPages(rows, caps);
    const pages = [];
    let cursor = 0;
    plan.forEach((item, idx) => {
      const chunk = rows.slice(cursor, cursor + item.count);
      cursor += item.count;
      pages.push(makePage({ continued: item.continued, final: item.final, rowsChunk: chunk }));
    });

    original.replaceWith(...pages);
    updatePageNumbers();
    document.documentElement.classList.add('estimate-pagination-ready');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
