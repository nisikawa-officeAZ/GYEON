"use client";

// GYEON partner onboarding — the shop-profile completion form
// (GYEON-PARTNER-ONBOARD-F1). Collects exactly the three required fields
// (電話番号 / 都道府県 / 住所) and submits them to completeGyeonShopProfile,
// which activates the invited owner membership atomically server-side.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeGyeonShopProfile } from "@/lib/dealer/complete-gyeon-shop-profile";
import Brand from "@/components/ui/Brand";

interface Props {
  shopName: string;
  initialPhone: string;
  initialPrefecture: string;
  initialAddress: string;
}

export default function ShopProfileForm({
  shopName,
  initialPhone,
  initialPrefecture,
  initialAddress,
}: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone);
  const [prefecture, setPrefecture] = useState(initialPrefecture);
  const [address, setAddress] = useState(initialAddress);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phone.trim()) { setError("電話番号を入力してください。"); return; }
    if (!prefecture.trim()) { setError("都道府県を入力してください。"); return; }
    if (!address.trim()) { setError("住所を入力してください。"); return; }

    setLoading(true);
    try {
      const result = await completeGyeonShopProfile({
        phone: phone.trim(),
        prefecture: prefecture.trim(),
        address: address.trim(),
      });

      if (result.kind === "completed" || result.kind === "already-active") {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      if (result.kind === "invalid-input") {
        setError(result.reasonJa);
        return;
      }
      if (result.kind === "not-eligible" || result.kind === "disabled") {
        setError("店舗の有効化情報が見つかりません。管理者にお問い合わせください。");
        return;
      }
      if (result.kind === "not-authenticated" || result.kind === "not-verified") {
        setError("ログイン状態を確認できません。ログインし直してください。");
        return;
      }
      setError("登録に失敗しました。しばらく待ってから再試行してください。");
    } catch {
      setError("予期しないエラーが発生しました。再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "var(--gs-bg-2, #111118)",
    border: "1px solid var(--gs-line, rgba(255,255,255,0.08))",
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-5">
        <div className="flex items-center justify-center">
          <Brand size={56} />
        </div>

        <div
          className="rounded-2xl border p-6 flex flex-col gap-5"
          style={{
            background: "var(--gs-bg-card, #16161f)",
            borderColor: "var(--gs-line, rgba(255,255,255,0.08))",
          }}
        >
          <div className="text-center">
            <h1 className="text-base font-bold text-[#f0f0f5]">店舗情報の入力</h1>
            <p className="text-xs text-[#9999b0] mt-1">
              <span className="text-[#f0f0f5] font-medium">{shopName}</span> の利用を開始するため、
              以下の情報を入力してください。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="shop-profile-form">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shop-profile-phone" className="text-xs font-medium text-[#9999b0]">
                電話番号 <span className="text-red-400">*</span>
              </label>
              <input
                id="shop-profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-[#f0f0f5] outline-none"
                style={inputStyle}
                placeholder="03-1234-5678"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="shop-profile-prefecture" className="text-xs font-medium text-[#9999b0]">
                都道府県 <span className="text-red-400">*</span>
              </label>
              <input
                id="shop-profile-prefecture"
                type="text"
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                autoComplete="address-level1"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-[#f0f0f5] outline-none"
                style={inputStyle}
                placeholder="東京都"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="shop-profile-address" className="text-xs font-medium text-[#9999b0]">
                住所 <span className="text-red-400">*</span>
              </label>
              <input
                id="shop-profile-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                autoComplete="street-address"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-[#f0f0f5] outline-none"
                style={inputStyle}
                placeholder="品川区…"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400" role="alert" data-testid="shop-profile-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: "var(--gs-blue, #4f8ef7)" }}
              data-testid="shop-profile-submit"
            >
              {loading ? "登録中…" : "登録して開始する"}
            </button>
          </form>

          <p className="text-[11px] text-[#55556a] leading-relaxed">
            入力いただいた情報は注文・請求のために使用されます。登録後、商品・発注メニューをすぐにご利用いただけます。
          </p>
        </div>
      </div>
    </div>
  );
}
