export const ESTIMATE_WIZARD_PANEL_CONFIG = {
  "service-availability": {
    labelJa: "施工メニュー提供設定",
    labelEn: "SERVICE AVAILABILITY",
    panelId: "section-service-offerings",
    sectionId: null,
  },
  "service-menus": {
    labelJa: "サービスメニュー",
    labelEn: "SERVICE MENUS",
    panelId: null,
    sectionId: "service",
  },
  // GDA-OTHER-COATINGS-R1 Stage A — reached from the settings hub (見積・価格) through the existing
  // generic [panel] route; the section hosts the B5 wheel / glass menus (settings surface only).
  "other-coatings": {
    labelJa: "その他のコーティング設定",
    labelEn: "OTHER COATINGS",
    panelId: null,
    sectionId: "other_coating",
  },
  "work-presets": {
    labelJa: "その他作業プリセット",
    labelEn: "WORK PRESETS",
    panelId: null,
    sectionId: "otherwork",
  },
  "shop-options": {
    labelJa: "店舗オプション",
    labelEn: "SHOP OPTIONS",
    panelId: null,
    sectionId: "store",
  },
  "coupons": {
    labelJa: "クーポン設定",
    labelEn: "COUPON SETTINGS",
    panelId: null,
    sectionId: "coupon",
  },
} as const;

export type EstimateWizardPanelSlug = keyof typeof ESTIMATE_WIZARD_PANEL_CONFIG;

export function getEstimateWizardPanelConfig(slug: string) {
  if (!(slug in ESTIMATE_WIZARD_PANEL_CONFIG)) return null;
  return ESTIMATE_WIZARD_PANEL_CONFIG[slug as EstimateWizardPanelSlug];
}

export function getEstimateWizardPanelHref(slug: EstimateWizardPanelSlug) {
  return `/settings/estimate-wizard/${slug}`;
}
