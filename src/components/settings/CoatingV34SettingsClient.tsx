"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  COATING_PRODUCT_LABELS,
  firstLayerOptions,
  isCoatingAvailableForRank,
  secondLayerOptions,
  thirdLayerOptions,
} from "@/components/estimates/wizard/screens/coating-matrix";
import type { ShopRank } from "@/components/estimates/wizard/screens/step-types";
import type { RankResolution } from "@/lib/dealer-settings/get-authoritative-shop-rank";
import {
  COATING_V34_BODY_SIZES,
  COATING_V34_CONTRACT_VERSION,
  type CoatingSettingsV34,
  type CoatingV34BodySize,
  type CoatingV34SizePriceMap,
} from "@/lib/pricing/coating-v34-contract";
import type { AuthoritativeCoatingV34ReadResult } from "@/lib/pricing/get-authoritative-coating-v34-settings";
import { saveAuthoritativeCoatingV34Settings } from "@/lib/pricing/save-authoritative-coating-v34-settings";
import {
  toPricingCatalogCoatingId,
  toPricingCatalogTopcoatId,
} from "@/lib/pricing/wizard-coating-id-adapter";

type Layer = "base" | "layer2" | "layer3";
type TextPrices = Record<string, string>;

interface ProductMeta {
  id: string;
  label: string;
}

const RANK_LABELS: Record<ShopRank, string> = {
  shop: "GYEON Shop",
  detailer: "GYEON Detailer",
  ppf_installer: "GYEON PPF Installer",
  certified: "GYEON Certified Detailer",
};

const EMPTY_PRICES = (): CoatingV34SizePriceMap =>
  Object.fromEntries(COATING_V34_BODY_SIZES.map((size) => [size, null])) as CoatingV34SizePriceMap;

const UNSAVED_DEFAULT_PRICES: Record<Layer, CoatingV34SizePriceMap> = {
  base: { SS: 65_000, S: 72_000, M: 80_000, ML: 88_000, L: 96_000, LL: 105_000, XL: 115_000 },
  layer2: { SS: 28_000, S: 31_000, M: 35_000, ML: 38_000, L: 42_000, LL: 46_000, XL: 50_000 },
  layer3: { SS: 18_000, S: 20_000, M: 23_000, ML: 25_000, L: 28_000, LL: 31_000, XL: 35_000 },
};

const DEFAULT_SELECTED_PRODUCT_IDS: Record<Exclude<ShopRank, "ppf_installer">, Record<Layer, string>> = {
  shop: { base: "one-evo", layer2: "cancoat-evo", layer3: "cancoat-evo" },
  detailer: { base: "pure-evo", layer2: "cancoat-evo", layer3: "cancoat-evo" },
  certified: { base: "infinit1", layer2: "infinit-t1", layer3: "infinit-t1" },
};

const BULK_COPY_SOURCE_PRODUCT_ID = "pure-evo";

function defaultProductId(rank: ShopRank, layer: Layer, products: ProductMeta[]): string | null {
  if (rank === "ppf_installer") return null;
  const preferred = DEFAULT_SELECTED_PRODUCT_IDS[rank][layer];
  return products.some((product) => product.id === preferred) ? preferred : products[0]?.id ?? null;
}

function applyUnsavedDefaultPrices(
  settings: CoatingSettingsV34,
  rank: ShopRank,
  catalogs: Record<Layer, ProductMeta[]>,
): { settings: CoatingSettingsV34; selected: Record<Layer, string | null> } {
  const selected = {
    base: defaultProductId(rank, "base", catalogs.base),
    layer2: defaultProductId(rank, "layer2", catalogs.layer2),
    layer3: defaultProductId(rank, "layer3", catalogs.layer3),
  } satisfies Record<Layer, string | null>;
  const baseSimulationSource = catalogs.base.some((product) => product.id === BULK_COPY_SOURCE_PRODUCT_ID)
    ? BULK_COPY_SOURCE_PRODUCT_ID
    : selected.base;
  const layer2SimulationSource = catalogs.layer2.some((product) => product.id === BULK_COPY_SOURCE_PRODUCT_ID)
    ? BULK_COPY_SOURCE_PRODUCT_ID
    : selected.layer2;

  return {
    selected,
    settings: {
      ...settings,
      baseProducts: settings.baseProducts.map((product) => product.productId === selected.base || product.productId === baseSimulationSource
        ? { ...product, active: true, pricesBySize: { ...UNSAVED_DEFAULT_PRICES.base } }
        : product),
      layer2Products: settings.layer2Products.map((product) => product.productId === selected.layer2 || product.productId === layer2SimulationSource
        ? { ...product, active: true, layer2PricesBySize: { ...UNSAVED_DEFAULT_PRICES.layer2 } }
        : product),
      layer3Products: settings.layer3Products.map((product) => product.productId === selected.layer3
        ? { ...product, active: true, layer3PricesBySize: { ...UNSAVED_DEFAULT_PRICES.layer3 } }
        : product),
    },
  };
}

function uniqueProducts(products: ProductMeta[]): ProductMeta[] {
  return [...new Map(products.map((product) => [product.id, product])).values()];
}

function baseProducts(rank: ShopRank): ProductMeta[] {
  return firstLayerOptions(rank).flatMap((product) => {
    const id = toPricingCatalogCoatingId(product.id);
    return id ? [{ id, label: product.label }] : [];
  });
}

function upperProducts(rank: ShopRank, layer: "layer2" | "layer3"): ProductMeta[] {
  const products = firstLayerOptions(rank).flatMap((base) =>
    (layer === "layer2" ? secondLayerOptions(base.id) : thirdLayerOptions(base.id)).flatMap((product) => {
      const id = toPricingCatalogTopcoatId(product.id);
      return id ? [{ id, label: product.label }] : [];
    }),
  );
  return uniqueProducts(products);
}

function fallbackLabel(productId: string): string {
  const canonical = Object.entries(COATING_PRODUCT_LABELS).find(([canonicalId]) =>
    toPricingCatalogCoatingId(canonicalId) === productId
    || toPricingCatalogTopcoatId(canonicalId) === productId,
  );
  return canonical?.[1] ?? productId;
}

function mergeCatalog(
  settings: CoatingSettingsV34,
  rank: ShopRank,
  legacyUpperProductIds: string[] = [],
): { settings: CoatingSettingsV34; catalogs: Record<Layer, ProductMeta[]> } {
  const allowedBase = baseProducts(rank);
  const allowedLayer2 = upperProducts(rank, "layer2");
  const allowedLayer3 = upperProducts(rank, "layer3");

  const catalogs = {
    base: uniqueProducts([
      ...allowedBase,
      ...settings.baseProducts.map((product) => ({ id: product.productId, label: fallbackLabel(product.productId) })),
    ]),
    layer2: uniqueProducts([
      ...allowedLayer2,
      ...legacyUpperProductIds.map((id) => ({ id, label: fallbackLabel(id) })),
      ...settings.layer2Products.map((product) => ({ id: product.productId, label: fallbackLabel(product.productId) })),
    ]),
    layer3: uniqueProducts([
      ...allowedLayer3,
      ...legacyUpperProductIds.map((id) => ({ id, label: fallbackLabel(id) })),
      ...settings.layer3Products.map((product) => ({ id: product.productId, label: fallbackLabel(product.productId) })),
    ]),
  } satisfies Record<Layer, ProductMeta[]>;

  return {
    catalogs,
    settings: {
      ...settings,
      baseProducts: catalogs.base.map((product) =>
        settings.baseProducts.find((entry) => entry.productId === product.id) ?? {
          productId: product.id,
          active: false,
          pricesBySize: EMPTY_PRICES(),
        },
      ),
      layer2Products: catalogs.layer2.map((product) =>
        settings.layer2Products.find((entry) => entry.productId === product.id) ?? {
          productId: product.id,
          active: false,
          layer2PricesBySize: EMPTY_PRICES(),
        },
      ),
      layer3Products: catalogs.layer3.map((product) =>
        settings.layer3Products.find((entry) => entry.productId === product.id) ?? {
          productId: product.id,
          active: false,
          layer3PricesBySize: EMPTY_PRICES(),
        },
      ),
    },
  };
}

function legacyDraft(resolution: Extract<AuthoritativeCoatingV34ReadResult, { status: "LEGACY_REVIEW_REQUIRED" }>): CoatingSettingsV34 {
  return {
    contractVersion: COATING_V34_CONTRACT_VERSION,
    baseProducts: resolution.candidates.baseProducts.map((product) => ({
      productId: product.productId,
      active: product.active,
      pricesBySize: { ...product.candidatePricesBySize },
    })),
    layer2Products: [],
    layer3Products: [],
    option_prices: { ...resolution.candidates.option_prices },
    option_names: { ...resolution.candidates.option_names },
  };
}

function emptyDraft(): CoatingSettingsV34 {
  return {
    contractVersion: COATING_V34_CONTRACT_VERSION,
    baseProducts: [],
    layer2Products: [],
    layer3Products: [],
    option_prices: {},
    option_names: {},
  };
}

function priceKey(layer: Layer, productId: string, size: CoatingV34BodySize): string {
  return `${layer}:${productId}:${size}`;
}

function initialTextPrices(settings: CoatingSettingsV34): TextPrices {
  const entries: Array<[string, string]> = [];
  for (const product of settings.baseProducts) {
    for (const size of COATING_V34_BODY_SIZES) {
      entries.push([priceKey("base", product.productId, size), product.pricesBySize[size]?.toLocaleString("ja-JP") ?? ""]);
    }
  }
  for (const product of settings.layer2Products) {
    for (const size of COATING_V34_BODY_SIZES) {
      entries.push([priceKey("layer2", product.productId, size), product.layer2PricesBySize[size]?.toLocaleString("ja-JP") ?? ""]);
    }
  }
  for (const product of settings.layer3Products) {
    for (const size of COATING_V34_BODY_SIZES) {
      entries.push([priceKey("layer3", product.productId, size), product.layer3PricesBySize[size]?.toLocaleString("ja-JP") ?? ""]);
    }
  }
  return Object.fromEntries(entries);
}

function normalizeDigits(value: string): string {
  return value
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replaceAll(",", "");
}

function layerPrices(settings: CoatingSettingsV34, layer: Layer, productId: string): CoatingV34SizePriceMap {
  if (layer === "base") {
    return settings.baseProducts.find((product) => product.productId === productId)?.pricesBySize ?? EMPTY_PRICES();
  }
  if (layer === "layer2") {
    return settings.layer2Products.find((product) => product.productId === productId)?.layer2PricesBySize ?? EMPTY_PRICES();
  }
  return settings.layer3Products.find((product) => product.productId === productId)?.layer3PricesBySize ?? EMPTY_PRICES();
}

function layerActive(settings: CoatingSettingsV34, layer: Layer, productId: string): boolean {
  if (layer === "base") return settings.baseProducts.find((product) => product.productId === productId)?.active ?? false;
  if (layer === "layer2") return settings.layer2Products.find((product) => product.productId === productId)?.active ?? false;
  return settings.layer3Products.find((product) => product.productId === productId)?.active ?? false;
}

function withLayerActive(settings: CoatingSettingsV34, layer: Layer, productId: string, active: boolean): CoatingSettingsV34 {
  if (layer === "base") return { ...settings, baseProducts: settings.baseProducts.map((product) => product.productId === productId ? { ...product, active } : product) };
  if (layer === "layer2") return { ...settings, layer2Products: settings.layer2Products.map((product) => product.productId === productId ? { ...product, active } : product) };
  return { ...settings, layer3Products: settings.layer3Products.map((product) => product.productId === productId ? { ...product, active } : product) };
}

function withParsedPrices(settings: CoatingSettingsV34, texts: TextPrices): CoatingSettingsV34 | null {
  const parse = (layer: Layer, productId: string): CoatingV34SizePriceMap | null => {
    const values: Partial<CoatingV34SizePriceMap> = {};
    for (const size of COATING_V34_BODY_SIZES) {
      const raw = normalizeDigits(texts[priceKey(layer, productId, size)] ?? "").trim();
      if (raw === "") {
        values[size] = null;
        continue;
      }
      if (!/^\d+$/.test(raw)) return null;
      const parsed = Number(raw);
      if (!Number.isSafeInteger(parsed)) return null;
      values[size] = parsed;
    }
    return values as CoatingV34SizePriceMap;
  };

  const baseProducts = settings.baseProducts.map((product) => {
    const pricesBySize = parse("base", product.productId);
    return pricesBySize ? { ...product, pricesBySize } : null;
  });
  const layer2Products = settings.layer2Products.map((product) => {
    const layer2PricesBySize = parse("layer2", product.productId);
    return layer2PricesBySize ? { ...product, layer2PricesBySize } : null;
  });
  const layer3Products = settings.layer3Products.map((product) => {
    const layer3PricesBySize = parse("layer3", product.productId);
    return layer3PricesBySize ? { ...product, layer3PricesBySize } : null;
  });
  if ([...baseProducts, ...layer2Products, ...layer3Products].some((product) => product === null)) return null;
  return {
    ...settings,
    baseProducts: baseProducts as CoatingSettingsV34["baseProducts"],
    layer2Products: layer2Products as CoatingSettingsV34["layer2Products"],
    layer3Products: layer3Products as CoatingSettingsV34["layer3Products"],
  };
}

function PriceLayer({
  layer,
  selectorTitle,
  priceTitle,
  selectorNote,
  splitPricePanel = false,
  products,
  settings,
  selected,
  onSelect,
  textPrices,
  onTextChange,
  confirmedFree,
  onConfirmFree,
  onToggleActive,
  bulkCopy,
}: {
  layer: Layer;
  selectorTitle: string;
  priceTitle: string;
  selectorNote: string;
  splitPricePanel?: boolean;
  products: ProductMeta[];
  settings: CoatingSettingsV34;
  selected: string | null;
  onSelect: (id: string) => void;
  textPrices: TextPrices;
  onTextChange: (key: string, value: string) => void;
  confirmedFree: Set<string>;
  onConfirmFree: (key: string, checked: boolean) => void;
  onToggleActive: () => void;
  bulkCopy?: {
    label: string;
    onClick: () => void;
  };
}) {
  const selectedProduct = products.find((product) => product.id === selected) ?? null;
  const prices = selectedProduct ? layerPrices(settings, layer, selectedProduct.id) : null;
  const active = selectedProduct ? layerActive(settings, layer, selectedProduct.id) : false;

  const priceContent = selectedProduct && prices ? (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-white sm:text-lg">{priceTitle}</h2>
          <p className="mt-1 text-sm text-[#93a4bd]">
            選択中のコーティング剤：<strong className="text-white">{selectedProduct.label}</strong>
          </p>
        </div>
        <p className="text-xs text-[#71819b]">7サイズ直接入力・円（税抜）</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" data-size-contract="SS,S,M,ML,L,LL,XL">
        {COATING_V34_BODY_SIZES.map((size) => {
          const key = priceKey(layer, selectedProduct.id, size);
          const value = textPrices[key] ?? (prices[size]?.toLocaleString("ja-JP") ?? "");
          const normalized = normalizeDigits(value).trim();
          const invalid = normalized !== "" && !/^\d+$/.test(normalized);
          const isFree = normalized === "0";
          return (
            <label key={size} className={`min-w-0 rounded-xl border p-2.5 ${invalid ? "border-red-500/60 bg-red-500/5" : "border-[#2d405e] bg-[#182235]"}`}>
              <span className="flex items-center justify-between text-xs font-bold text-[#5ea2ff]">
                {size}
                <span className="text-[9px] font-medium text-[#5c6b84]">税抜</span>
              </span>
              <div className="mt-2 flex min-w-0 items-center gap-1.5">
                <input
                  inputMode="numeric"
                  value={value}
                  onChange={(event) => onTextChange(key, event.target.value)}
                  onBlur={() => {
                    if (/^\d+$/.test(normalized)) onTextChange(key, Number(normalized).toLocaleString("ja-JP"));
                  }}
                  placeholder="未設定"
                  aria-invalid={invalid}
                  className="min-w-0 flex-1 rounded-lg border border-[#334765] bg-[#111827] px-2 py-2 text-right text-sm font-medium text-white outline-none transition placeholder:text-[#52627b] focus:border-[#4788ff]"
                />
                <span className="shrink-0 text-[10px] text-[#71819b]">円</span>
              </div>
              {invalid ? <span className="mt-2 block text-xs text-red-300">0以上の整数を入力してください</span> : null}
              {isFree ? (
                <span className="mt-2 flex items-center gap-2 text-[10px] text-amber-200">
                  <input
                    type="checkbox"
                    checked={confirmedFree.has(key)}
                    onChange={(event) => onConfirmFree(key, event.target.checked)}
                    className="h-4 w-4 accent-[#2f6bff]"
                  />
                  無料提供として確認
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-5 text-[#5c6b84]">
        空欄は未設定として扱い、0円へ自動変換しません。表示時は3桁カンマ、保存時は整数（税抜）で保持します。
      </p>
    </div>
  ) : null;

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-[#263955] bg-[#101827]/95 p-5 shadow-[0_18px_55px_rgba(1,7,20,0.28)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#e8eef7] sm:text-lg">{selectorTitle}</h2>
            <p className="mt-2 text-xs leading-5 text-[#5c6b84]">{selectorNote}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {bulkCopy ? (
              <button
                type="button"
                onClick={bulkCopy.onClick}
                className="min-h-11 rounded-xl border border-[#4788ff] bg-[#10264d] px-4 text-sm font-semibold text-[#8bbcff] transition hover:bg-[#17366f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ea2ff]"
              >
                {bulkCopy.label}
              </button>
            ) : null}
            {selectedProduct ? (
              <button
                type="button"
                onClick={onToggleActive}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${active ? "border-[#2f6bff] bg-[#12316c] text-[#8bbcff]" : "border-[#41506a] bg-[#1a2434] text-[#93a4bd]"}`}
              >
                {active ? "提供中" : "提供しない"}
              </button>
            ) : null}
          </div>
        </div>

        {bulkCopy ? (
          <p className="mt-3 text-right text-xs leading-5 text-[#71819b]">
            画面上の未保存価格だけに反映します。「保存する」を押すまでは登録されません。
          </p>
        ) : null}

        {products.length === 0 ? (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
            現在の店舗ランクでは、この層のコーティング価格を設定できません。
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" role="group" aria-label={`${selectorTitle}の商品`}>
              {products.map((product) => {
                const isSelected = selected === product.id;
                return (
                  <button
                    key={product.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelect(product.id)}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-center text-xs font-semibold transition ${isSelected ? "border-[#4788ff] bg-[#2f6bff] text-white shadow-[0_0_24px_rgba(47,107,255,0.22)]" : "border-[#2d405e] bg-[#182235] text-[#e8eef7] hover:border-[#4788ff]/70 hover:text-white"}`}
                  >
                    {product.label}
                  </button>
                );
              })}
            </div>
            {!splitPricePanel && priceContent ? <div className="mt-5 border-t border-[#263955] pt-5">{priceContent}</div> : null}
          </>
        )}
      </section>

      {splitPricePanel && priceContent ? (
        <section className="rounded-2xl border border-[#263955] bg-[#101827]/95 p-5 shadow-[0_18px_55px_rgba(1,7,20,0.28)] sm:p-6">
          {priceContent}
        </section>
      ) : null}
    </div>
  );
}

export default function CoatingV34SettingsClient({
  resolution,
  rank,
}: {
  resolution: AuthoritativeCoatingV34ReadResult;
  rank: RankResolution;
}) {
  if (!rank.ok) {
    return <BlockedState title="店舗ランクを確認できません" message="権限事故を防ぐため、コーティング設定を停止しました。DAスーパーアドミンへ店舗ランクの確認を依頼してください。" />;
  }
  if (resolution.status === "UNAUTHENTICATED") {
    return <BlockedState title="ログインが必要です" message="コーティング設定を開くには、もう一度ログインしてください。" />;
  }
  if (resolution.status === "READ_FAILED" || resolution.status === "INVALID_STORED_PAYLOAD") {
    return <BlockedState title="価格設定を安全に読み込めません" message="既存設定を上書きしないよう、編集を停止しました。データ状態を確認してから再実行してください。" />;
  }
  if (!isCoatingAvailableForRank(rank.rank)) {
    return <BlockedState title="コーティング設定は利用できません" message="現在の店舗ランクはPPF専業です。コーティング価格を誤って登録しないよう、編集を停止しました。" />;
  }

  const initial = resolution.status === "V34_READY"
    ? resolution.settings
    : resolution.status === "LEGACY_REVIEW_REQUIRED"
      ? legacyDraft(resolution)
      : emptyDraft();
  const legacyUpperProductIds = resolution.status === "LEGACY_REVIEW_REQUIRED"
    ? resolution.candidates.unassignedUpperLayerProducts.map((product) => product.productId)
    : [];
  const merged = mergeCatalog(initial, rank.rank, legacyUpperProductIds);
  const prepared = resolution.status === "NOT_CONFIGURED"
    ? applyUnsavedDefaultPrices(merged.settings, rank.rank, merged.catalogs)
    : {
        settings: merged.settings,
        selected: {
          base: defaultProductId(rank.rank, "base", merged.catalogs.base),
          layer2: defaultProductId(rank.rank, "layer2", merged.catalogs.layer2),
          layer3: defaultProductId(rank.rank, "layer3", merged.catalogs.layer3),
        },
      };

  return <CoatingEditor resolution={resolution} rank={rank.rank} initial={prepared.settings} initialSelected={prepared.selected} catalogs={merged.catalogs} />;
}

function CoatingEditor({
  resolution,
  rank,
  initial,
  initialSelected,
  catalogs,
}: {
  resolution: Exclude<AuthoritativeCoatingV34ReadResult, { status: "UNAUTHENTICATED" | "READ_FAILED" | "INVALID_STORED_PAYLOAD" }>;
  rank: ShopRank;
  initial: CoatingSettingsV34;
  initialSelected: Record<Layer, string | null>;
  catalogs: Record<Layer, ProductMeta[]>;
}) {
  const [settings, setSettings] = useState(initial);
  const [selected, setSelected] = useState<Record<Layer, string | null>>(initialSelected);
  const [textPrices, setTextPrices] = useState<TextPrices>(() => initialTextPrices(initial));
  const [confirmedFree, setConfirmedFree] = useState<Set<string>>(() => {
    const keys = Object.entries(initialTextPrices(initial)).filter(([, value]) => normalizeDigits(value) === "0").map(([key]) => key);
    return new Set(keys);
  });
  const [legacyAssignments, setLegacyAssignments] = useState<Record<string, { layer2: boolean; layer3: boolean }>>(() =>
    resolution.status === "LEGACY_REVIEW_REQUIRED"
      ? Object.fromEntries(resolution.candidates.unassignedUpperLayerProducts.map((product) => [product.productId, { layer2: false, layer3: false }]))
      : {},
  );
  const [legacyBaseConfirmed, setLegacyBaseConfirmed] = useState(resolution.status !== "LEGACY_REVIEW_REQUIRED");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasUnconfirmedZero = useMemo(
    () => Object.entries(textPrices).some(([key, value]) => normalizeDigits(value).trim() === "0" && !confirmedFree.has(key)),
    [textPrices, confirmedFree],
  );

  const updateText = (key: string, value: string) => {
    const normalized = normalizeDigits(value);
    setTextPrices((current) => ({ ...current, [key]: normalized }));
    if (normalized.trim() !== "0") {
      setConfirmedFree((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
    setNotice(null);
  };

  const toggleActive = (layer: Layer) => {
    const id = selected[layer];
    if (!id) return;
    setSettings((current) => withLayerActive(current, layer, id, !layerActive(current, layer, id)));
    setNotice(null);
  };

  const bulkCopyPrices = (
    sourceLayer: Layer,
    targetLayer: Layer,
    targetProducts: ProductMeta[],
    successText: string,
  ) => {
    const sourceProductExists = catalogs[sourceLayer].some((product) => product.id === BULK_COPY_SOURCE_PRODUCT_ID);
    if (!sourceProductExists) return;

    setTextPrices((current) => {
      const sourcePrices = layerPrices(settings, sourceLayer, BULK_COPY_SOURCE_PRODUCT_ID);
      const next = { ...current };
      for (const product of targetProducts) {
        for (const size of COATING_V34_BODY_SIZES) {
          const sourceKey = priceKey(sourceLayer, BULK_COPY_SOURCE_PRODUCT_ID, size);
          const targetKey = priceKey(targetLayer, product.id, size);
          next[targetKey] = current[sourceKey] ?? (sourcePrices[size]?.toLocaleString("ja-JP") ?? "");
        }
      }
      return next;
    });
    setConfirmedFree((current) => {
      const next = new Set(current);
      for (const product of targetProducts) {
        for (const size of COATING_V34_BODY_SIZES) next.delete(priceKey(targetLayer, product.id, size));
      }
      return next;
    });
    setNotice({ kind: "success", text: successText });
  };

  const save = () => {
    setNotice(null);
    if (hasUnconfirmedZero) {
      setNotice({ kind: "error", text: "0円を入力した項目は「無料提供として確認」を選択してください。" });
      return;
    }
    if (!legacyBaseConfirmed) {
      setNotice({ kind: "error", text: "旧1層目価格の変換候補を確認してください。" });
      return;
    }

    let next = withParsedPrices(settings, textPrices);
    if (!next) {
      setNotice({ kind: "error", text: "価格には0以上の整数だけを入力してください。" });
      return;
    }

    if (resolution.status === "LEGACY_REVIEW_REQUIRED") {
      const unresolved = resolution.candidates.unassignedUpperLayerProducts.find((product) => {
        const assignment = legacyAssignments[product.productId];
        return !assignment?.layer2 && !assignment?.layer3;
      });
      if (unresolved) {
        setNotice({ kind: "error", text: `旧追加価格「${fallbackLabel(unresolved.productId)}」を2層目または3層目へ明示的に割り当ててください。` });
        return;
      }
      for (const candidate of resolution.candidates.unassignedUpperLayerProducts) {
        const assignment = legacyAssignments[candidate.productId];
        if (assignment.layer2) {
          const existing: boolean = next.layer2Products.some((product) => product.productId === candidate.productId);
          next = {
            ...next,
            layer2Products: existing
              ? next.layer2Products.map((product) => product.productId === candidate.productId
                ? { ...product, active: true, layer2PricesBySize: { ...candidate.candidatePricesBySize } }
                : product)
              : [...next.layer2Products, {
                productId: candidate.productId,
                active: true,
                layer2PricesBySize: { ...candidate.candidatePricesBySize },
              }],
          };
        }
        if (assignment.layer3) {
          const existing: boolean = next.layer3Products.some((product) => product.productId === candidate.productId);
          next = {
            ...next,
            layer3Products: existing
              ? next.layer3Products.map((product) => product.productId === candidate.productId
                ? { ...product, active: true, layer3PricesBySize: { ...candidate.candidatePricesBySize } }
                : product)
              : [...next.layer3Products, {
                productId: candidate.productId,
                active: true,
                layer3PricesBySize: { ...candidate.candidatePricesBySize },
              }],
          };
        }
      }
    }

    const payload = next;
    startTransition(async () => {
      const result = await saveAuthoritativeCoatingV34Settings(payload);
      if (result.status === "SAVED") {
        setSettings(result.settings);
        setTextPrices(initialTextPrices(result.settings));
        setNotice({ kind: "success", text: "コーティング価格を保存しました。" });
      } else if (result.status === "UNAUTHORIZED") {
        setNotice({ kind: "error", text: "保存権限がありません。オーナーまたはマネージャーで実行してください。" });
      } else if (result.status === "INVALID_PAYLOAD") {
        setNotice({ kind: "error", text: "入力内容がV3.4価格契約と一致しません。内容を確認してください。" });
      } else {
        setNotice({ kind: "error", text: "保存に失敗しました。既存設定は変更されていません。" });
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#5c6b84]">
        <p className="tracking-[0.14em]">DETAILER AGENT / SETTINGS / <span className="font-bold text-[#5ea2ff]">COATING / {rank.toUpperCase()}</span></p>
        <Link href="/settings" className="min-h-11 rounded-xl border border-[#2d405e] px-4 py-3 font-semibold text-[#8bbcff] hover:border-[#4788ff]">設定一覧へ戻る</Link>
      </div>

      <section className="mt-4 rounded-2xl border border-[#263955] bg-[linear-gradient(135deg,rgba(24,43,79,.76),rgba(13,22,38,.92))] p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#31588f] bg-[#10264d] text-[#5ea2ff] shadow-[0_0_26px_rgba(47,107,255,0.16)]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.7">
              <path d="M12 3 19 6v5c0 4.4-2.7 8.1-7 10-4.3-1.9-7-5.6-7-10V6l7-3Z" />
              <path d="m9.2 12 1.8 1.8 3.9-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#e8eef7] sm:text-2xl">コーティング設定（{RANK_LABELS[rank]}）</h1>
            <p className="mt-1 text-xs font-bold tracking-[0.2em] text-[#5ea2ff]">COATING SETTINGS — 7 SIZES / {RANK_LABELS[rank].toUpperCase()}</p>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-[#263955] bg-[linear-gradient(135deg,rgba(24,43,79,.72),rgba(13,22,38,.9))] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[#71819b]">STORE RANK / READ ONLY</p>
            <p className="mt-1 text-lg font-bold text-white">{RANK_LABELS[rank]}</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#93a4bd]">店舗ランクと正式な施工組み合わせ規則は読み取り専用です。この画面では価格と提供状態だけを変更します。</p>
      </section>

      {resolution.status === "LEGACY_REVIEW_REQUIRED" ? (
        <section className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 sm:p-6">
          <p className="font-bold text-amber-200">旧価格設定から7サイズ別価格へ変換しました</p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">旧1層目候補は確認後に保存できます。旧共有トップコート価格は層を自動判定しません。各商品を2層目・3層目へ明示的に割り当ててください。</p>
          <label className="mt-4 flex items-center gap-2 text-sm text-amber-100">
            <input type="checkbox" checked={legacyBaseConfirmed} onChange={(event) => setLegacyBaseConfirmed(event.target.checked)} className="h-4 w-4 accent-[#2f6bff]" />
            1層目の変換候補を確認しました
          </label>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {resolution.candidates.unassignedUpperLayerProducts.map((product) => (
              <div key={product.productId} className="rounded-xl border border-amber-500/25 bg-[#0b1321] p-4">
                <p className="font-semibold text-white">{fallbackLabel(product.productId)}</p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#d7c38b]">
                  {(["layer2", "layer3"] as const).map((layer) => (
                    <label key={layer} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={legacyAssignments[product.productId]?.[layer] ?? false}
                        onChange={(event) => setLegacyAssignments((current) => ({
                          ...current,
                          [product.productId]: { ...current[product.productId], [layer]: event.target.checked },
                        }))}
                        className="h-4 w-4 accent-[#2f6bff]"
                      />
                      {layer === "layer2" ? "2層目に割り当て" : "3層目に割り当て"}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {resolution.status === "NOT_CONFIGURED" ? (
        <div className="mt-5 rounded-xl border border-[#31588f] bg-[#10264d]/55 px-4 py-3 text-sm leading-6 text-[#b8cdf0]">
          現在設定されている価格はシミュレーション用の価格を表示しています。御社の規定の金額を入力し保存を押してからアプリをご使用ください。
        </div>
      ) : null}

      <div className="mt-5 grid gap-5">
        <PriceLayer
          layer="base"
          selectorTitle="1層目コーティング剤"
          priceTitle="ベース価格（1層目・税抜）"
          selectorNote="店舗ランクと正式マトリクスで利用できる1層目商品のみ表示します。商品ボタンを選ぶとサイズ別価格が切り替わります。"
          splitPricePanel
          products={catalogs.base}
          settings={settings}
          selected={selected.base}
          onSelect={(id) => setSelected((current) => ({ ...current, base: id }))}
          textPrices={textPrices}
          onTextChange={updateText}
          confirmedFree={confirmedFree}
          onConfirmFree={(key, checked) => setConfirmedFree((current) => { const next = new Set(current); checked ? next.add(key) : next.delete(key); return next; })}
          onToggleActive={() => toggleActive("base")}
          bulkCopy={catalogs.base.some((product) => product.id === BULK_COPY_SOURCE_PRODUCT_ID) ? {
            label: "PURE価格を1層目へ一括反映",
            onClick: () => bulkCopyPrices(
              "base",
              "base",
              catalogs.base,
              "Q² PURE EVOの7サイズ価格を、1層目の全コーティング剤へ反映しました。保存するまでは未登録です。",
            ),
          } : undefined}
        />
        <PriceLayer
          layer="layer2"
            selectorTitle="2層目コーティング剤（追加価格・税抜）"
            priceTitle="2層目追加価格（税抜）"
            selectorNote="2層目に使用可能な商品のみ表示します。1層目とは別の7サイズ価格として保存します。"
            products={catalogs.layer2}
            settings={settings}
            selected={selected.layer2}
            onSelect={(id) => setSelected((current) => ({ ...current, layer2: id }))}
            textPrices={textPrices}
            onTextChange={updateText}
            confirmedFree={confirmedFree}
            onConfirmFree={(key, checked) => setConfirmedFree((current) => { const next = new Set(current); checked ? next.add(key) : next.delete(key); return next; })}
          onToggleActive={() => toggleActive("layer2")}
          bulkCopy={catalogs.layer2.some((product) => product.id === BULK_COPY_SOURCE_PRODUCT_ID) ? {
            label: "PURE価格を2層目へ一括反映",
            onClick: () => bulkCopyPrices(
              "layer2",
              "layer2",
              catalogs.layer2,
              "Q² PURE EVOの2層目7サイズ価格を、2層目の全コーティング剤へ反映しました。保存するまでは未登録です。",
            ),
          } : undefined}
        />
        <PriceLayer
          layer="layer3"
            selectorTitle="3層目コーティング剤（追加価格・税抜）"
            priceTitle="3層目追加価格（税抜）"
            selectorNote="3層目に使用可能な商品のみ表示します。2層目とは別の7サイズ価格として保存します。"
            products={catalogs.layer3}
            settings={settings}
            selected={selected.layer3}
            onSelect={(id) => setSelected((current) => ({ ...current, layer3: id }))}
            textPrices={textPrices}
            onTextChange={updateText}
            confirmedFree={confirmedFree}
            onConfirmFree={(key, checked) => setConfirmedFree((current) => { const next = new Set(current); checked ? next.add(key) : next.delete(key); return next; })}
          onToggleActive={() => toggleActive("layer3")}
          bulkCopy={catalogs.layer2.some((product) => product.id === BULK_COPY_SOURCE_PRODUCT_ID) ? {
            label: "PUREの2層目価格を3層目へ一括反映",
            onClick: () => bulkCopyPrices(
              "layer2",
              "layer3",
              catalogs.layer3,
              "Q² PURE EVOの2層目7サイズ価格を、3層目の全コーティング剤へ反映しました。保存するまでは未登録です。",
            ),
          } : undefined}
        />
      </div>

      <section className="mt-5 rounded-2xl border border-[#263955] bg-[#101827]/95 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-[#5ea2ff]">COATING OPTIONS</p>
            <h2 className="mt-1 text-xl font-bold text-white">コーティングオプション施工</h2>
          </div>
          <Link href="/settings/service-durations" className="text-sm font-semibold text-[#5ea2ff] hover:text-white">想定施工時間を設定 →</Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {Object.keys(settings.option_names).map((id) => (
            <div key={id} className="grid gap-2 rounded-xl border border-[#263955] bg-[#08111f] p-3 sm:grid-cols-[1fr_160px]">
              <input
                value={settings.option_names[id]}
                onChange={(event) => setSettings((current) => ({ ...current, option_names: { ...current.option_names, [id]: event.target.value } }))}
                aria-label={`${id}の名称`}
                className="min-h-11 rounded-lg border border-[#334765] bg-[#060c17] px-3 text-sm text-white outline-none focus:border-[#4788ff]"
              />
              <label className="flex min-h-11 items-center rounded-lg border border-[#334765] bg-[#060c17] px-3">
                <input
                  inputMode="numeric"
                  value={settings.option_prices[id]?.toLocaleString("ja-JP") ?? ""}
                  onChange={(event) => {
                    const raw = normalizeDigits(event.target.value);
                    if (raw !== "" && !/^\d+$/.test(raw)) return;
                    setSettings((current) => ({ ...current, option_prices: { ...current.option_prices, [id]: raw === "" ? 0 : Number(raw) } }));
                  }}
                  aria-label={`${settings.option_names[id]}の税抜価格`}
                  className="min-w-0 flex-1 bg-transparent text-right text-sm text-white outline-none"
                />
                <span className="ml-2 text-xs text-[#71819b]">円</span>
              </label>
            </div>
          ))}
          {Object.keys(settings.option_names).length === 0 ? <p className="text-sm text-[#71819b]">付帯オプションは未設定です。</p> : null}
        </div>
      </section>

      {notice ? (
        <div role="status" className={`mt-5 rounded-xl border p-4 text-sm ${notice.kind === "success" ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-200" : "border-red-500/40 bg-red-500/5 text-red-200"}`}>{notice.text}</div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#263955] bg-[#101827]/95 p-5">
        <p className="text-sm text-[#71819b]">画面を開いただけでは保存されません。内容を確認してから保存してください。</p>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="min-h-12 min-w-40 rounded-xl border border-[#4b8cff] bg-[#2f6bff] px-6 font-bold text-white shadow-[0_12px_30px_rgba(47,107,255,0.28)] transition hover:bg-[#3e78ff] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "保存中…" : "保存する"}
        </button>
      </div>
    </div>
  );
}

function BlockedState({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-red-500/30 bg-[#101827] p-6 sm:p-8">
        <p className="text-xs font-bold tracking-[0.2em] text-red-300">COATING SETTINGS BLOCKED</p>
        <h1 className="mt-2 text-2xl font-bold text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#93a4bd]">{message}</p>
        <Link href="/settings" className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-[#2d405e] px-4 text-sm font-semibold text-[#8bbcff]">設定一覧へ戻る</Link>
      </div>
    </div>
  );
}
