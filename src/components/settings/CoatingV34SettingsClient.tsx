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
  title,
  subtitle,
  products,
  settings,
  selected,
  onSelect,
  textPrices,
  onTextChange,
  confirmedFree,
  onConfirmFree,
  onToggleActive,
}: {
  layer: Layer;
  title: string;
  subtitle: string;
  products: ProductMeta[];
  settings: CoatingSettingsV34;
  selected: string | null;
  onSelect: (id: string) => void;
  textPrices: TextPrices;
  onTextChange: (key: string, value: string) => void;
  confirmedFree: Set<string>;
  onConfirmFree: (key: string, checked: boolean) => void;
  onToggleActive: () => void;
}) {
  const selectedProduct = products.find((product) => product.id === selected) ?? null;
  const prices = selectedProduct ? layerPrices(settings, layer, selectedProduct.id) : null;
  const active = selectedProduct ? layerActive(settings, layer, selectedProduct.id) : false;

  return (
    <section className="rounded-2xl border border-[#263955] bg-[#101827]/95 p-5 shadow-[0_18px_55px_rgba(1,7,20,0.28)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-[#5ea2ff]">{subtitle}</p>
          <h2 className="mt-1 text-xl font-bold text-[#e8eef7]">{title}</h2>
        </div>
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

      {products.length === 0 ? (
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          現在の店舗ランクでは、この層のコーティング価格を設定できません。
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={`${title}の商品`}>
            {products.map((product) => {
              const isSelected = selected === product.id;
              const isActive = layerActive(settings, layer, product.id);
              return (
                <button
                  key={product.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(product.id)}
                  className={`min-h-11 rounded-xl border px-4 py-2 text-left text-sm font-semibold transition ${isSelected ? "border-[#4788ff] bg-[#17346b] text-white shadow-[0_0_24px_rgba(47,107,255,0.22)]" : "border-[#2d405e] bg-[#0b1321] text-[#93a4bd] hover:border-[#4788ff]/70 hover:text-white"}`}
                >
                  {product.label}
                  <span className={`ml-2 text-[10px] ${isActive ? "text-emerald-300" : "text-[#5c6b84]"}`}>{isActive ? "有効" : "未設定"}</span>
                </button>
              );
            })}
          </div>

          {selectedProduct && prices ? (
            <div className="mt-6">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <p className="font-semibold text-white">{selectedProduct.label}</p>
                <p className="text-xs text-[#71819b]">7サイズ直接入力・円（税抜）</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-size-contract="SS,S,M,ML,L,LL,XL">
                {COATING_V34_BODY_SIZES.map((size) => {
                  const key = priceKey(layer, selectedProduct.id, size);
                  const value = textPrices[key] ?? (prices[size]?.toLocaleString("ja-JP") ?? "");
                  const normalized = normalizeDigits(value).trim();
                  const invalid = normalized !== "" && !/^\d+$/.test(normalized);
                  const isFree = normalized === "0";
                  return (
                    <label key={size} className={`rounded-xl border p-3 ${invalid ? "border-red-500/60 bg-red-500/5" : "border-[#263955] bg-[#08111f]"}`}>
                      <span className="flex items-center justify-between text-sm font-bold text-[#e8eef7]">
                        {size}
                        <span className="text-[10px] font-medium text-[#5c6b84]">税抜</span>
                      </span>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          inputMode="numeric"
                          value={value}
                          onChange={(event) => onTextChange(key, event.target.value)}
                          onBlur={() => {
                            if (/^\d+$/.test(normalized)) onTextChange(key, Number(normalized).toLocaleString("ja-JP"));
                          }}
                          placeholder="未設定"
                          aria-invalid={invalid}
                          className="min-w-0 flex-1 rounded-lg border border-[#334765] bg-[#060c17] px-3 py-2.5 text-right text-base font-semibold text-white outline-none transition placeholder:text-[#52627b] focus:border-[#4788ff]"
                        />
                        <span className="text-xs text-[#71819b]">円</span>
                      </div>
                      {invalid ? <span className="mt-2 block text-xs text-red-300">0以上の整数を入力してください</span> : null}
                      {isFree ? (
                        <span className="mt-2 flex items-center gap-2 text-xs text-amber-200">
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
            </div>
          ) : null}
        </>
      )}
    </section>
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

  return <CoatingEditor resolution={resolution} rank={rank.rank} initial={merged.settings} catalogs={merged.catalogs} />;
}

function CoatingEditor({
  resolution,
  rank,
  initial,
  catalogs,
}: {
  resolution: Exclude<AuthoritativeCoatingV34ReadResult, { status: "UNAUTHENTICATED" | "READ_FAILED" | "INVALID_STORED_PAYLOAD" }>;
  rank: ShopRank;
  initial: CoatingSettingsV34;
  catalogs: Record<Layer, ProductMeta[]>;
}) {
  const [settings, setSettings] = useState(initial);
  const [selected, setSelected] = useState<Record<Layer, string | null>>({
    base: catalogs.base[0]?.id ?? null,
    layer2: catalogs.layer2[0]?.id ?? null,
    layer3: catalogs.layer3[0]?.id ?? null,
  });
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
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1d3150] pb-5">
        <div>
          <p className="text-xs font-bold tracking-[0.24em] text-[#5ea2ff]">COATING SETTINGS</p>
          <h1 className="mt-1 text-2xl font-bold text-[#e8eef7] sm:text-3xl">コーティング設定</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71819b]">1層目・2層目・3層目で使用する液剤と、SS〜XLの7サイズ税抜価格を層ごとに設定します。</p>
        </div>
        <Link href="/settings" className="min-h-11 rounded-xl border border-[#2d405e] px-4 py-3 text-sm font-semibold text-[#8bbcff] hover:border-[#4788ff]">設定一覧へ戻る</Link>
      </div>

      <section className="mt-5 rounded-2xl border border-[#263955] bg-[linear-gradient(135deg,rgba(24,43,79,.72),rgba(13,22,38,.9))] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[#71819b]">STORE RANK / READ ONLY</p>
            <p className="mt-1 text-lg font-bold text-white">{RANK_LABELS[rank]}</p>
          </div>
          <span className="rounded-full border border-[#31588f] bg-[#10264d] px-4 py-2 text-xs font-semibold text-[#8bbcff]">V3.4・7サイズ契約</span>
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

      <div className="mt-5 grid gap-5">
        <PriceLayer
          layer="base"
          title="ベース価格（1層目・税抜）"
          subtitle="BASE COAT / LAYER 1"
          products={catalogs.base}
          settings={settings}
          selected={selected.base}
          onSelect={(id) => setSelected((current) => ({ ...current, base: id }))}
          textPrices={textPrices}
          onTextChange={updateText}
          confirmedFree={confirmedFree}
          onConfirmFree={(key, checked) => setConfirmedFree((current) => { const next = new Set(current); checked ? next.add(key) : next.delete(key); return next; })}
          onToggleActive={() => toggleActive("base")}
        />
        <div className="grid gap-5 xl:grid-cols-2">
          <PriceLayer
            layer="layer2"
            title="2層目価格設定（税抜）"
            subtitle="LAYER 2 DIRECT PRICES"
            products={catalogs.layer2}
            settings={settings}
            selected={selected.layer2}
            onSelect={(id) => setSelected((current) => ({ ...current, layer2: id }))}
            textPrices={textPrices}
            onTextChange={updateText}
            confirmedFree={confirmedFree}
            onConfirmFree={(key, checked) => setConfirmedFree((current) => { const next = new Set(current); checked ? next.add(key) : next.delete(key); return next; })}
            onToggleActive={() => toggleActive("layer2")}
          />
          <PriceLayer
            layer="layer3"
            title="3層目価格設定（税抜）"
            subtitle="LAYER 3 DIRECT PRICES"
            products={catalogs.layer3}
            settings={settings}
            selected={selected.layer3}
            onSelect={(id) => setSelected((current) => ({ ...current, layer3: id }))}
            textPrices={textPrices}
            onTextChange={updateText}
            confirmedFree={confirmedFree}
            onConfirmFree={(key, checked) => setConfirmedFree((current) => { const next = new Set(current); checked ? next.add(key) : next.delete(key); return next; })}
            onToggleActive={() => toggleActive("layer3")}
          />
        </div>
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
