// DEV-ONLY isolated fixtures for Certificate PDF visual verification (PHASE 12G).
// NOT imported by any production path — kept as regression assets so a future change to the
// certificate templates can be re-verified against the approved concept-b reference data.
//
// Wording is transcribed from the approved concept-b mocks and DESIGN_SPEC_CERTIFICATE §05a–c. The
// brand is the neutral sample dealer (NOT Office AZ), proving every issuer value is injected from
// BrandProfile. No internal data (cost, margin, memo) appears anywhere — the contract has no place
// to put it.

import { gyeonRankLogo, gyeonWordmark } from "@/lib/pdf/brand-assets";
import { sampleBrand } from "../../estimate/__fixtures__/sample-estimate";
import type { BrandProfile } from "../../../types";
import type { CertificateDocumentData } from "../certificate-data";

/** Coating / CanCoat are issued by a Certified Detailer. */
export const certificateBrand: BrandProfile = {
  ...sampleBrand,
  gyeonWordmarkUrl: gyeonWordmark(),
  rankLogoUrl: gyeonRankLogo("certified-detailer"),
};

/** PPF requires PPF Installer certification (DESIGN_SPEC_CERTIFICATE §05b). */
export const ppfCertificateBrand: BrandProfile = {
  ...certificateBrand,
  business: {
    ...sampleBrand.business,
    shopRank: "ppf-installer",
    shopRankLabel: "GYEON PPF Installer",
  },
  rank: "ppf-installer",
  rankLogoUrl: gyeonRankLogo("ppf-installer"),
};

const customer = { name: "石井 紗也華", honorific: "様" };

const vehicle = {
  name: "Ferrari 458 Italia",
  year: "2015",
  color: "ロッソコルサ / Red",
  vin: "ZFF67NFA5F0206789",
  plate: "名古屋 332 ひ 3830",
};

const installation = { appliedDate: "2026-07-20", technician: "西川 篤史" };

const PRIVACY =
  "本書に記入させて頂いた個人情報の内容に関しては、施工証明管理およびアフターサービスに必要な範囲内で使用し、その他の目的には一切使用しないよう、厳重に保管する事をお約束いたします。";

const FROM_GYEON = {
  labelEn: "From GYEON",
  labelJa: "GYEONからお知らせ",
  paragraphs: [
    "GYEONではメンテナンスやクリーニングがご自身で簡単に施工出来るクリーナーやメンテナンスグッズ、コーティング剤などを豊富にご準備しております。GYEON施工店や取扱店でお買い求めやご相談ください。",
  ],
};

// ── 05a Coating ──────────────────────────────────────────────────────────────

export const sampleCoatingCertificate: CertificateDocumentData = {
  kind: "coating",
  serial: "CRT/CO/2026/00087",
  serialDisplay: "— 0005097",
  issueDate: "2026-07-20",
  titleJa: "GYEON コーティング施工証明書",
  titleEn: "Certificate of Installation / Coating",
  programLabel: "Coating · Certified Detailer",
  programSubLabel: "Japan Official Program",
  intro:
    "本書は、下記車両に GYEON コーティング（Q² MOHS / MOHS EVO / DuraFlex 等のベースコーティング）を正規手順に従って施工したことを証明するものです。施工皮膜に対しては、下記「Infinity Warranty」の条件に基づく保証を付与いたします。",
  customer,
  vehicle,
  installation,
  productLabelEn: "Applied Coating",
  productLabelJa: "施工コーティング内訳",
  productColumns: { tag: "Layer", name: "Product · 使用製品", appliedTo: "Applied To · 施工箇所" },
  products: [
    {
      tag: "Base",
      name: "Q² MOHS EVO",
      description: "Base ceramic coating",
      appliedTo: "全塗装面 / All body panels",
    },
    {
      tag: "Top",
      name: "Q² MOHS EVO Top Coat",
      description: "Top layer for hydrophobic finish",
      appliedTo: "全塗装面 / All body panels",
    },
  ],
  callout: {
    mark: "∞",
    eyebrow: "The most transparent warranty on the market",
    title: "INFINITY WARRANTY",
    body: "GYEON 純正メンテナンスケミカル（CURE / WETCOAT / Q²M シリーズ 等）による定期メンテナンスが継続されている限り、本証書に記載された施工皮膜に対する保証を継続いたします。皮膜が本来の性能を発揮している状態を保証対象とし、GYEON 本国 (gyeon.co) の Infinity Warranty Program に準拠します。",
    tone: "navy",
  },
  terms: {
    left: [
      {
        labelEn: "Coverage",
        labelJa: "保証の対象",
        paragraphs: [
          "GYEON コーティングを施工した車両の施工面（塗装面）が通常の使用状況において、明らかに塗装の劣化や剥離・ひび割れ・変色したと認められる場合。但し樹脂素材（バンパー・モール・サイドミラー等）やトラックの荷室部等は対象外とします。",
        ],
      },
      {
        labelEn: "Scope",
        labelJa: "保証の範囲",
        paragraphs: ["保証につきましては、剥離・ひび割れ・変色のみとする。"],
      },
    ],
    right: [
      {
        labelEn: "Exclusions",
        labelJa: "■ 保証の除外",
        items: [
          "施工後1ヶ月以内に洗車機による洗車を行った場合。",
          "樹液及び動物の糞尿、虫、黄砂等や融雪剤等を直ちに取り除かなかったために付着したシミ・ムラが出来た場合。",
          "専用メンテナンスクリーナー（CURE）、以外によるメンテ表面処理を行った場合。",
          "通常の状態で起こり得ない化学物質（農薬などの強いアルカリ、酸、その他）の塗布又は散布を行った場合。",
          "石や岩片等による損傷、事故等による外的損傷の場合。",
          "物理的に塗面を強くこするような行為や衝撃を与えたりするような行為があった場合。",
          "加工や交換又は再塗装など修理された箇所。",
          "鉄粉や不純物などの付着による光沢の劣化の場合。",
          "以前に GYEON コーティング以外の除去できないコーティング加工を行っている場合。",
        ],
      },
    ],
  },
  care: [
    {
      labelEn: "Care Instructions",
      labelJa: "お客様へのお願い事項",
      paragraphs: [
        "普段のお手入れは専用カーシャンプー（BATHE・BATHE+・FOME）による洗車を月1〜2回のペースで行って下さい。",
      ],
    },
    FROM_GYEON,
  ],
  privacyNotice: PRIVACY,
  footerProgramLine: "GYEON Coating Japan Certified Detailer",
};

// ── 05b PPF ──────────────────────────────────────────────────────────────────

export const samplePpfCertificate: CertificateDocumentData = {
  kind: "ppf",
  serial: "CRT/PPF/2026/00042",
  serialDisplay: "— 0005142",
  issueDate: "2026-07-20",
  titleJa: "GYEON PPF 施工証明書",
  titleEn: "Certificate of Installation / Paint Protection Film",
  programLabel: "PPF · Installer",
  programSubLabel: "Japan Official Program",
  intro:
    "本書は、下記車両に GYEON PPF（ペイントプロテクションフィルム）を GYEON 認定 PPF Installer による正規手順に従って施工したことを証明するものです。施工フィルムのうち、変色保証の対象となる商品については下記「Film Warranty」に記載いたします。",
  customer,
  vehicle,
  installation,
  productLabelEn: "Applied Films",
  productLabelJa: "施工フィルム内訳",
  productColumns: { tag: "Type", name: "Applied To · 施工箇所", appliedTo: "Film Product · 使用フィルム" },
  // Installed areas are typed input — never inferred from the film's label.
  products: [
    { tag: "Protect+", name: "フルボディ", description: "Full Body", appliedTo: 'PROTECT+ 60"' },
    { tag: "Enhance", name: "ヘッドライト", description: "Headlight", appliedTo: 'ENHANCE PHOBIC 24"' },
    { tag: "Protect+", name: "ドアミラー", description: "Door Mirror", appliedTo: 'PROTECT+ 12"' },
    { tag: "Hybrid", name: "フロントガラス", description: "Windshield", appliedTo: 'HYBRID 30"' },
  ],
  filmWarranty: {
    titleEn: "Film Warranty — Discoloration",
    titleJa: "フィルム保証（変色）",
    intro:
      "本証書に記載された施工フィルムのうち、以下の商品にはメーカーによる変色保証が付与されます。保証は正規メンテナンスの継続および下記「保証の除外」に該当しないことを前提とします。",
    items: [
      { product: "PROTECT+", coverage: "変色 10 年 保証" },
      { product: "HYBRID", coverage: "変色 10 年 保証" },
      { product: "ENHANCE PHOBIC", coverage: "変色 7 年 保証" },
      { product: "ENHANCE PHILIC", coverage: "変色 7 年 保証" },
    ],
    note: "保証対象外の商品：MATTE / BLACK / TINT / CARBON / COLOR LINE ── これらの商品はメーカー変色保証の対象外です。上記表示のない施工箇所には変色保証は適用されません。",
  },
  terms: {
    left: [
      {
        labelEn: "Coverage",
        labelJa: "保証の対象",
        paragraphs: [
          "上記「Film Warranty」に記載された商品について、通常の使用状況下でフィルム自体に発生した以下の不具合を保証対象とします。",
        ],
        items: [
          "フィルムの異変・変色",
          "フィルムのひび割れ・気泡発生（施工不良に起因するもの）",
          "接着剤層の劣化による密着不良",
        ],
      },
      {
        labelEn: "Scope",
        labelJa: "保証の範囲",
        paragraphs: [
          "本保証はフィルム自体の性能に関するものであり、下地塗装の状態および施工瑕疵以外の損傷を保証するものではありません。認定される場合、フィルムの張替えまたは補修対応をもって保証履行とします。",
        ],
      },
    ],
    right: [
      {
        labelEn: "Exclusions",
        labelJa: "■ 保証の除外",
        items: [
          "飛び石・岩片・砂利等の外的衝撃による損傷、擦り傷、切り裂き。",
          "事故・接触・落下物・悪意ある行為（イタズラ・落書き等）による損傷。",
          "フィルム上に施工された他社コーティング剤・ワックス・研磨剤の使用による表面劣化。",
          "施工後1ヶ月以内の高圧洗浄機・洗車機による洗車、および接近しての高圧噴射。",
          "樹液・鳥糞・虫・融雪剤・鉄粉等を直ちに除去しなかったことによるシミ・変色。",
          "加工・交換・再塗装等が施された箇所への施工、および純正塗装以外の下地。",
          "お客様ご自身または第三者による剥離・貼り直し・部分カット等の改変。",
          "火災・地震・水害・その他不可抗力による損傷。",
          "本証書に記載のない箇所または保証対象外商品への保証適用の申し出。",
        ],
      },
    ],
  },
  care: [
    {
      labelEn: "Care Instructions",
      labelJa: "お客様へのお願い事項",
      paragraphs: [
        "普段のお手入れは pH 中性のカーシャンプー（BATHE・BATHE+ 等）による手洗い洗車を月1〜2回のペースで行って下さい。高圧洗浄機はフィルム端部から 30cm 以上離してご使用ください。",
      ],
    },
    {
      labelEn: "From GYEON",
      labelJa: "GYEONからお知らせ",
      paragraphs: [
        "PPF フィルムは自己修復性能（Self-Healing）を有しますが、深い傷や切り裂きは対象外です。定期点検・部分張替えのご相談は、施工店までお気軽にお問い合わせください。",
      ],
    },
  ],
  privacyNotice: PRIVACY,
  footerProgramLine: "GYEON PPF Japan Installer",
};

// ── 05c CanCoat (unified — EVO and EVO PRO share this one document) ──────────

export const sampleCancoatCertificate: CertificateDocumentData = {
  kind: "cancoat",
  serial: "CRT/CC/2026/00113",
  serialDisplay: "— 0005113",
  issueDate: "2026-07-20",
  titleJa: "GYEON コーティング施工証明書",
  titleEn: "Certificate of Installation / Coating (CanCoat)",
  programLabel: "CanCoat · Certified Detailer",
  programSubLabel: "Japan Official Program",
  intro:
    "本書は、下記車両に GYEON CanCoat シリーズ（Q² CanCoat EVO / CanCoat EVO PRO）を、GYEON 認定 Detailer による正規手順に従って施工した事実を証明するものです。GYEON CanCoat はセミパーマネント層として位置付けられるコーティングであり、本書は具体的な保障行為を伴うものではありません。",
  customer,
  vehicle,
  installation,
  productLabelEn: "Applied Coating",
  productLabelJa: "施工コーティング内訳",
  productColumns: { tag: "Layer", name: "Product · 使用製品", appliedTo: "Applied To · 施工箇所" },
  // EVO vs EVO PRO is expressed here, in the product row — not by a separate template.
  products: [
    {
      tag: "CanCoat",
      name: "Q² CanCoat EVO",
      description: "Semi-permanent ceramic layer (CanCoat EVO)",
      appliedTo: "全塗装面 / All body panels",
    },
  ],
  callout: {
    mark: "✓",
    eyebrow: "This is a Certificate of Installation, not a Warranty",
    title: "PROOF OF INSTALLATION",
    body: "本証明書は GYEON CanCoat シリーズ（EVO / EVO PRO）の施工事実を証明するものであり、保証書ではありません。固定の保証期間は設けておりませんが、GYEON 純正メンテナンスケミカルによる定期メンテナンスを継続されることで、皮膜本来の性能を長く保つことができます。GYEON MOHS・MOHS EVO 等のベースコーティング施工車両には、別途「GYEON コーティング施工証明書」を発行いたします。",
    tone: "grey",
  },
  terms: {
    left: [
      {
        labelEn: "Purpose",
        labelJa: "本証明書の位置付け",
        paragraphs: [
          "GYEON CanCoat シリーズは、パネルプレップから塗布・硬化までを GYEON 認定 Detailer が実施したセミパーマネントコーティングです。CanCoat EVO / CanCoat EVO PRO のうち、いずれの製品を施工したかは上記「施工コーティング内訳」欄に記載されます。皮膜の保持と光沢の長期化のためには、GYEON 純正メンテナンスケミカル（CURE / WETCOAT / Q²M シリーズ 等）による定期メンテナンスを強く推奨いたします。",
        ],
      },
    ],
    right: [
      {
        labelEn: "Handling Notice",
        labelJa: "■ 取り扱い上の注意",
        items: [
          "施工直後の皮膜完結前（1ヶ月以内）には、洗車機・高圧洗浄機による洗車を避けてください。",
          "樹液・鳥糞・虫・黄砂・融雪剤等は、皮膜のシミ・ムラの原因となりますので、気づき次第早めに取り除いてください。",
          "日常のメンテナンスには、GYEON 専用カーシャンプー（BATHE・BATHE+・FOME）による月1〜2回の手洗い洗車を推奨いたします。",
          "専用クリーナー（CURE 等）以外の化学剤による表面処理はご遠慮ください。",
          "強いアルカリ・酸・有機溶剤等での拭取・塗布は避けてください。",
          "石跡・浅いキズなど施工面の応急対応は、GYEON 施工店までご相談ください。",
        ],
      },
    ],
  },
  care: [
    FROM_GYEON,
    {
      labelEn: "Recommendation",
      labelJa: "アップグレードのご案内",
      paragraphs: [
        "より高い耐候性・光沢持続性をご希望のお客様には、上位グレードの Q² CanCoat EVO PRO または GYEON MOHS EVO のご検討をお勧めいたします。",
      ],
    },
  ],
  privacyNotice: PRIVACY,
  footerProgramLine: "GYEON Coating Japan Certified Detailer",
};

/** Same CanCoat document, issued for the Pro grade — proves the unified template covers both. */
export const sampleCancoatProCertificate: CertificateDocumentData = {
  ...sampleCancoatCertificate,
  serial: "CRT/CC/2026/00114",
  serialDisplay: "— 0005114",
  products: [
    {
      tag: "CanCoat",
      name: "Q² CanCoat EVO PRO",
      description: "Semi-permanent ceramic layer (Pro grade)",
      appliedTo: "全塗装面 / All body panels",
    },
  ],
};

/** Exercises the opt-in signature block, which the approved fronts do not show. */
export const sampleCoatingCertificateWithSignatures: CertificateDocumentData = {
  ...sampleCoatingCertificate,
  signatures: {
    customerLabel: "Customer ・ お客様",
    installerLabel: "Installer ・ 施工者",
    installerName: "西川 篤史",
  },
};
