"use client";

// Branding settings form.
//
// Manages ONLY branding concerns (per the UX spec): Logo, Stamp, Primary /
// Secondary / Accent colours, and the (future) Customer App theme. Store-profile
// fields live in the separate 店舗設定 form (CompanySettingsForm).
//
// Logo & stamp are uploaded via the reusable ImageUploadField → uploadBrandingImage
// server action (dealer_id resolved server-side). Only the storage path + resolved
// preview URL are kept in state; the user never pastes a URL.

import { useState, useTransition } from "react";
import ImageUploadField from "@/components/ui/ImageUploadField";
import StampField from "@/components/settings/StampField";
import { uploadBrandingImage } from "@/lib/branding/upload-branding-image";
import { saveBrandingSettings } from "@/lib/branding/save-branding-settings";
import {
  BRANDING_COLOR_DEFAULTS,
  type BrandingSettings,
  type CustomerAppTheme,
} from "@/lib/branding/branding-types";
import type { StampKind } from "@/lib/stamp/stamp-types";

interface Props {
  initial: BrandingSettings | null;
}

const THEME_OPTIONS: { value: CustomerAppTheme; label: string }[] = [
  { value: "system", label: "システムに合わせる" },
  { value: "light",  label: "ライト" },
  { value: "dark",   label: "ダーク" },
];

function ColorField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer p-0.5"
          aria-label={`${label} カラーピッカー`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="w-28 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
        />
      </div>
    </div>
  );
}

export default function BrandingSettingsForm({ initial }: Props) {
  const [logoPath,  setLogoPath]  = useState<string | null>(initial?.logo_path  ?? null);
  const [logoUrl,   setLogoUrl]   = useState<string | null>(initial?.logo_url   ?? null);
  const [stampPath, setStampPath] = useState<string | null>(initial?.stamp_path ?? null);
  const [stampUrl,  setStampUrl]  = useState<string | null>(initial?.stamp_url  ?? null);
  const [stampKind, setStampKind] = useState<StampKind | null>(initial?.stamp_kind ?? null);

  const [primary,   setPrimary]   = useState(initial?.brand_primary_color   ?? BRANDING_COLOR_DEFAULTS.brand_primary_color);
  const [secondary, setSecondary] = useState(initial?.brand_secondary_color ?? BRANDING_COLOR_DEFAULTS.brand_secondary_color);
  const [accent,    setAccent]    = useState(initial?.brand_accent_color    ?? BRANDING_COLOR_DEFAULTS.brand_accent_color);
  const [theme,     setTheme]     = useState<CustomerAppTheme>(initial?.customer_app_theme ?? "system");

  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("logo_path",  logoPath  ?? "");
    fd.set("logo_url",   logoUrl   ?? "");
    fd.set("stamp_path", stampPath ?? "");
    fd.set("stamp_url",  stampUrl  ?? "");
    fd.set("stamp_kind", stampKind ?? "");
    fd.set("brand_primary_color",   primary);
    fd.set("brand_secondary_color", secondary);
    fd.set("brand_accent_color",    accent);
    fd.set("customer_app_theme",    theme);

    startTransition(async () => {
      const result = await saveBrandingSettings(fd);
      if ("error" in result) {
        setStatus("error");
        setErrorMsg(result.error);
      } else {
        setStatus("saved");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col gap-5">

      {/* ── ロゴ・スタンプ ── */}
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">ロゴ・スタンプ</p>
        <ImageUploadField
          label="ショップロゴ"
          slot="logo"
          uploadAction={uploadBrandingImage}
          value={logoUrl}
          onUploaded={(path, url) => { setLogoPath(path); setLogoUrl(url); setStatus("idle"); }}
          hint="PDF・完了報告・顧客アプリで使用されます"
        />
        <StampField
          value={stampUrl}
          valueKind={stampKind}
          onSaved={(path, url, kind) => { setStampPath(path); setStampUrl(url); setStampKind(kind); setStatus("idle"); }}
        />
      </div>

      {/* ── カラー ── */}
      <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">カラー</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ColorField label="プライマリ"   value={primary}   onChange={(v) => { setPrimary(v);   setStatus("idle"); }} />
          <ColorField label="セカンダリ"   value={secondary} onChange={(v) => { setSecondary(v); setStatus("idle"); }} />
          <ColorField label="アクセント"   value={accent}    onChange={(v) => { setAccent(v);    setStatus("idle"); }} />
        </div>
      </div>

      {/* ── 顧客アプリテーマ（今後対応） ── */}
      <div className="flex flex-col gap-2 border-t border-slate-800 pt-4">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">顧客アプリテーマ</p>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">今後対応</span>
        </div>
        <select
          value={theme}
          onChange={(e) => { setTheme(e.target.value as CustomerAppTheme); setStatus("idle"); }}
          className="w-full sm:w-64 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
        >
          {THEME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#0f172a]">{o.label}</option>
          ))}
        </select>
        <p className="text-[10px] text-slate-600">将来の顧客向けアプリのテーマ設定です。今のうちに保存しておけます。</p>
      </div>

      {/* ── 保存 ── */}
      <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {pending ? "保存中..." : "保存する"}
        </button>
        {status === "saved" && <span className="text-xs text-green-400 font-medium">保存しました</span>}
        {status === "error" && <span className="text-xs text-red-400">{errorMsg || "保存に失敗しました"}</span>}
      </div>
    </form>
  );
}
