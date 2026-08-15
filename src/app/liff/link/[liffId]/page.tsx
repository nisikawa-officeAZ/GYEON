"use client";

// GYEON-LINE-SETUP-F2 — LIFF customer-link page.
//
// Route shape: /liff/link/{liffId}?t={opaque token}
//
// The dealer-specific LIFF ID is in the PATH, so it is available before
// liff.init() — there is no environment-variable fallback and no dependence on a
// query parameter that LINE may relocate.
//
// The opaque token is read from the FINAL browser URL only AFTER liff.init()
// resolves: LINE temporarily parks the original query behind liff.state during
// the login round-trip, so reading it earlier can miss or truncate it.
//
// The browser POSTs exactly { token, id_token }. It never sees or sends a
// customer id, dealer id, or any other internal identifier.

import { use, useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    liff?: {
      init: (config: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: () => void;
      getIDToken: () => string | null;
      isInClient: () => boolean;
      closeWindow: () => void;
    };
  }
}

type Status = "loading" | "login" | "linking" | "success" | "error";

const LIFF_SDK_SRC = "https://static.line-scdn.net/liff/edge/versions/2.22.3/sdk.js";

/** LIFF IDs are `{LINE Login channel id}-{suffix}`. Anything else is refused. */
function isValidLiffId(value: string): boolean {
  return /^[0-9]{6,}-[0-9a-zA-Z]+$/.test(value);
}

/**
 * Read the opaque token from the CURRENT location. Called only after
 * liff.init() has resolved, so the original query string has been restored.
 */
function readTokenFromLocation(): string {
  const direct = new URLSearchParams(window.location.search).get("t");
  if (direct) return direct;

  // Fallback for the liff.state form, in case a client keeps the wrapper.
  const state = new URLSearchParams(window.location.search).get("liff.state");
  if (state) {
    const inner = state.startsWith("?") ? state.slice(1) : state;
    return new URLSearchParams(inner).get("t") ?? "";
  }
  return "";
}

export default function LiffLinkPage({
  params,
}: {
  params: Promise<{ liffId: string }>;
}) {
  const { liffId } = use(params);

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  const doLink = useCallback(async () => {
    // Read AFTER init: LINE restores the original query only once init resolves.
    const token = readTokenFromLocation();
    if (!token) {
      setStatus("error");
      setMessage("連携リンクが無効です");
      return;
    }

    const idToken = window.liff!.getIDToken();
    if (!idToken) {
      setStatus("error");
      setMessage("LINEトークンの取得に失敗しました");
      return;
    }

    setStatus("linking");

    const res = await fetch("/api/line/liff/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, id_token: idToken }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      display_name?: string;
    };

    if (!res.ok || !data.success) {
      setStatus("error");
      setMessage(data.error ?? "連携に失敗しました");
      return;
    }

    setStatus("success");
    setMessage(`${data.display_name ?? "LINE"} との連携が完了しました`);

    setTimeout(() => {
      if (window.liff?.isInClient()) window.liff.closeWindow();
    }, 2000);
  }, []);

  useEffect(() => {
    if (!isValidLiffId(liffId)) {
      setStatus("error");
      setMessage("連携リンクが無効です");
      return;
    }

    const script = document.createElement("script");
    script.src = LIFF_SDK_SRC;
    script.onload = async () => {
      try {
        await window.liff!.init({ liffId });

        if (!window.liff!.isLoggedIn()) {
          setStatus("login");
          window.liff!.login();
          return;
        }

        await doLink();
      } catch {
        setStatus("error");
        setMessage("LIFFの初期化に失敗しました");
      }
    };
    script.onerror = () => {
      setStatus("error");
      setMessage("LIFF SDKの読み込みに失敗しました");
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [liffId, doLink]);

  return (
    <div className="min-h-screen bg-[#06C755] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
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
