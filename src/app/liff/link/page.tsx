"use client";

// LIFF page: /liff/link?customer_id=...
// Runs inside LINE app via LIFF.
// Performs LINE Login, then POSTs id_token + customer_id to /api/line/liff/link.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

declare global {
  interface Window {
    liff?: {
      init: (config: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: () => void;
      getIDToken: () => string | null;
      getProfile: () => Promise<{ userId: string; displayName: string; pictureUrl?: string }>;
      isInClient: () => boolean;
      closeWindow: () => void;
    };
  }
}

type Status = "loading" | "login" | "linking" | "success" | "error";

function LiffLinkContent() {
  const searchParams  = useSearchParams();
  const customerId    = searchParams.get("customer_id");
  const liffIdParam   = searchParams.get("liff_id");

  const [status,  setStatus]  = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!customerId) {
      setStatus("error");
      setMessage("customer_id が指定されていません");
      return;
    }

    const liffId = liffIdParam ?? process.env.NEXT_PUBLIC_LINE_LIFF_ID ?? "";
    if (!liffId) {
      setStatus("error");
      setMessage("LIFF ID が設定されていません");
      return;
    }

    // Load LIFF SDK
    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/versions/2.22.3/sdk.js";
    script.onload = () => initLiff(liffId);
    script.onerror = () => { setStatus("error"); setMessage("LIFF SDKの読み込みに失敗しました"); };
    document.head.appendChild(script);

    return () => { document.head.removeChild(script); };
  }, [customerId, liffIdParam]);

  async function initLiff(liffId: string) {
    try {
      await window.liff!.init({ liffId });

      if (!window.liff!.isLoggedIn()) {
        setStatus("login");
        window.liff!.login();
        return;
      }

      await doLink();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "LIFFの初期化に失敗しました");
    }
  }

  async function doLink() {
    setStatus("linking");
    const id_token = window.liff!.getIDToken();
    if (!id_token) {
      setStatus("error");
      setMessage("LINEトークンの取得に失敗しました");
      return;
    }

    const res = await fetch("/api/line/liff/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token, customer_id: customerId }),
    });

    const data = await res.json() as { success?: boolean; error?: string; display_name?: string };

    if (!res.ok || data.error) {
      setStatus("error");
      setMessage(data.error ?? "連携に失敗しました");
      return;
    }

    setStatus("success");
    setMessage(`${data.display_name ?? "LINE"} との連携が完了しました`);

    // Close LIFF window after 2 seconds
    setTimeout(() => {
      if (window.liff?.isInClient()) {
        window.liff.closeWindow();
      }
    }, 2000);
  }

  return (
    <div className="min-h-screen bg-[#06C755] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        {/* LINE logo */}
        <div className="w-16 h-16 bg-[#06C755] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white text-3xl font-bold">L</span>
        </div>

        {status === "loading" && (
          <>
            <h1 className="text-lg font-bold text-gray-900 mb-2">LINE連携</h1>
            <p className="text-sm text-gray-500">読み込み中...</p>
            <div className="mt-4 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#06C755] border-t-transparent rounded-full animate-spin" />
            </div>
          </>
        )}

        {status === "login" && (
          <>
            <h1 className="text-lg font-bold text-gray-900 mb-2">LINEログイン</h1>
            <p className="text-sm text-gray-500">LINEアカウントでログインしています...</p>
          </>
        )}

        {status === "linking" && (
          <>
            <h1 className="text-lg font-bold text-gray-900 mb-2">連携中</h1>
            <p className="text-sm text-gray-500">LINEアカウントを連携しています...</p>
            <div className="mt-4 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#06C755] border-t-transparent rounded-full animate-spin" />
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">連携完了</h1>
            <p className="text-sm text-gray-600">{message}</p>
            <p className="text-xs text-gray-400 mt-2">このページは自動的に閉じます</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-red-500">✕</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">エラー</h1>
            <p className="text-sm text-red-500">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function LiffLinkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#06C755] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LiffLinkContent />
    </Suspense>
  );
}
