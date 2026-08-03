(() => {
  const safe = (v) => (v == null ? '' : String(v));
  const text = (selector, value) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = safe(value);
    });
  };
  const html = (selector, value) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.innerHTML = safe(value);
    });
  };
  const setVisible = (selector, visible) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.style.display = visible ? '' : 'none';
    });
  };

  const normalizeStoreSettings = (input) => {
    if (!input) return null;
    const contact = input.contact || {};
    const business = input.business || {};
    return {
      brandId: input.brandId || input.brand_id || '',
      colors: input.colors || {},
      storeLogoSrc: input.storeLogoSrc || input.logoSrc || input.logo_url || '',
      companyName: input.companyName || input.company_name || input.brand_name_ja || input.brandNameJa || '',
      postalCode: input.postalCode || input.postal_code || contact.postal_code || '',
      address: input.address || contact.address || '',
      tel: input.tel || contact.tel || '',
      fax: input.fax || contact.fax || '',
      rank: input.rank || input.shopRank || business.shop_rank || '',
      invoiceRegistrationNumber: input.invoiceRegistrationNumber || input.invoice_registration_number || business.invoice_registration_number || '',
    };
  };

  const resolveStoreSettings = async () => {
    const ctx = window.__DEALER_OS_DOC_CONTEXT__ || {};
    if (ctx.storeSettings) return normalizeStoreSettings(ctx.storeSettings);
    if (ctx.storeLogoSrc || ctx.companyName || ctx.company_name || ctx.brand_name_ja) return normalizeStoreSettings(ctx);
    return null;
  };

  const applyStoreSettings = (store) => {
    const root = document.documentElement;
    if (!store) {
      root.classList.add('brand-ready');
      return;
    }
    if (store.brandId) document.body.dataset.brand = store.brandId;
    if (store.colors?.primary) root.style.setProperty('--brand-primary', store.colors.primary);
    if (store.colors?.primary_dark) root.style.setProperty('--brand-primary-dark', store.colors.primary_dark);
    if (store.colors?.primary_tint) root.style.setProperty('--brand-primary-tint', store.colors.primary_tint);

    const logo = document.querySelector('[data-brand-logo="store"]');
    if (logo) {
      if (store.storeLogoSrc) {
        logo.src = store.storeLogoSrc;
        logo.alt = safe(store.companyName || 'Store logo');
        logo.hidden = false;
      } else {
        logo.removeAttribute('src');
        logo.alt = '';
        logo.hidden = true;
      }
    }

    text('[data-brand-field="brand_name_ja"]', store.companyName || '');
    text('[data-brand-field="postal_code"]', store.postalCode || '');
    html('[data-brand-field="address"]', safe(store.address || '').replace(/\n/g, '<br>'));
    text('[data-brand-field="tel"]', store.tel || '');
    text('[data-brand-field="fax"]', store.fax || '');
    text('[data-brand-field="shop_rank_header"]', store.rank || '');
    text('[data-brand-field="invoice_registration_number"]', store.invoiceRegistrationNumber || '');

    setVisible('[data-brand-prefix="postal_code"]', !!store.postalCode);
    setVisible('[data-row="fax"]', !!store.fax);
    setVisible('[data-row="header-rank"]', !!store.rank);
    setVisible('[data-row="invoice_registration_number"]', !!store.invoiceRegistrationNumber);

    root.classList.add('brand-ready');
  };

  window.__dealerBrandReadyPromise = resolveStoreSettings()
    .then(applyStoreSettings)
    .catch((err) => {
      console.error('brand apply failed', err);
      document.documentElement.classList.add('brand-ready');
    });
})();
