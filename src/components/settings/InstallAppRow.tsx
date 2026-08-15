"use client";

// UX-1B — “利用環境 / アプリとして利用”.
//
// One compact row inside the settings hub. Deliberately NOT a dashboard banner, a
// promotional card, a modal, or a login-time interruption: installing the app is a
// preference an operator looks for, not something the product should interrupt work
// to advertise.
//
// Three states, and only three:
//   installed        → no call to action at all, just a small “アプリとして利用中” chip
//   prompt available → “アプリとして追加”, which fires the browser's OWN prompt
//   otherwise        → one line of guidance, and NO button
//
// The last case matters. A Chromium browser only fires `beforeinstallprompt` when the
// app actually qualifies (production build, HTTPS, service worker, manifest) and the
// app is not already installed. Rendering a disabled “install” button in that state
// would promise something the page cannot deliver, so this shows the manual
// browser-menu route instead.
//
// Detection is feature-based: `beforeinstallprompt` for the prompt, `display-mode:
// standalone` (plus the iOS-only `navigator.standalone`) for the installed state. The
// single user-agent test exists ONLY to choose between two wordings of the manual
// guidance — never to gate a capability.
//
// No persistence, no network, no database, no permissions, no route changes.

import { useCallback, useEffect, useState } from "react";

/** The Chromium-only event. Not in the DOM lib, so it is typed narrowly here. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "unknown" | "installed" | "promptable" | "manual";

/** True when the page is running as an installed app rather than a browser tab. */
function detectInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneDisplay =
    typeof window.matchMedia === "function" &&
    ["standalone", "minimal-ui", "fullscreen"].some((m) => window.matchMedia(`(display-mode: ${m})`).matches);
  // iOS Safari predates display-mode and reports its own flag instead.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneDisplay || iosStandalone;
}

/** Wording only. Safari offers “Dockに追加 / ホーム画面に追加” and never fires the prompt event. */
function isSafariFamily(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|android/i.test(ua);
}

export default function InstallAppRow() {
  const [mode, setMode] = useState<Mode>("unknown");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [safari, setSafari] = useState(false);

  useEffect(() => {
    setSafari(isSafariFamily());

    if (detectInstalled()) {
      setMode("installed");
      return;
    }
    setMode("manual"); // until the browser tells us otherwise

    const onBeforeInstallPrompt = (e: Event) => {
      // Suppress the browser's own mini-infobar so the only entry point is this row.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("promptable");
    };
    const onInstalled = () => {
      setDeferred(null);
      setMode("installed");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    try {
      // Fired ONLY from this click. A stored event may be used once, so it is
      // released either way; if the operator dismisses it, the row falls back to
      // manual guidance rather than offering a button that can no longer work.
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      setMode(outcome === "accepted" ? "installed" : "manual");
    } catch {
      setDeferred(null);
      setMode("manual");
    }
  }, [deferred]);

  // Nothing is rendered until the environment has been read, so the row never
  // flashes a call to action at an operator who already installed the app.
  if (mode === "unknown") return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/40 border border-slate-800 rounded-xl">
      <span className="shrink-0 text-slate-500" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="4" y="1.5" width="8" height="13" rx="1.5" />
          <path d="M7 12.5h2" />
        </svg>
      </span>

      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-xs font-medium text-slate-300">利用環境 / アプリとして利用</p>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          {mode === "installed"
            ? "ブラウザのタブではなく、独立したアプリとして起動しています。"
            : mode === "promptable"
              ? "ブラウザを開かずに、デスクトップから直接起動できます。"
              : safari
                ? "Safariでは共有メニューから「Dockに追加」してください。"
                : "ブラウザのメニューから「アプリをインストール」を選択してください。"}
        </p>
      </div>

      <div className="ml-auto shrink-0">
        {mode === "installed" ? (
          <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
            アプリとして利用中
          </span>
        ) : mode === "promptable" ? (
          <button
            type="button"
            onClick={install}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            アプリとして追加
          </button>
        ) : null}
      </div>
    </div>
  );
}
